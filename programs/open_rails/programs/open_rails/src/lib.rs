use anchor_lang::prelude::*;

declare_id!("BwxnJR3UjoLYM3oPEHA5742zWLu2HSrGFDAKqDEQumvv");

// -------- Limits (MVP constraints) --------
pub const MAX_NAME: usize = 64;
pub const MAX_URI: usize = 200;
pub const MAX_ACTION_CODE: usize = 32;
pub const MAX_EVENT_CODE: usize = 32;
pub const MAX_LOCATION_CELL: usize = 64;
pub const MAX_EVIDENCE_HASH: usize = 128;
pub const MAX_CONTEXT: usize = 128;

#[program]
pub mod open_rails {
    use super::*;

    /// Organizer profile (authority = organizer wallet)
    pub fn create_organizer(ctx: Context<CreateOrganizer>, name: String) -> Result<()> {
        require!(
            name.as_bytes().len() <= MAX_NAME,
            OpenRailsError::NameTooLong
        );

        let organizer = &mut ctx.accounts.organizer;
        organizer.authority = ctx.accounts.authority.key();
        organizer.name = name;
        organizer.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// POA = special case of action: "ATTENDED_EVENT"
    /// Represented as Event with claim_code (encoded in QR/claim link)
    pub fn create_event(
        ctx: Context<CreateEvent>,
        name: String,
        uri: String,
        start_ts: i64,
        end_ts: i64,
        claim_code: String,
    ) -> Result<()> {
        require!(
            name.as_bytes().len() <= MAX_NAME,
            OpenRailsError::NameTooLong
        );
        require!(uri.as_bytes().len() <= MAX_URI, OpenRailsError::UriTooLong);
        require!(
            claim_code.as_bytes().len() <= MAX_EVENT_CODE,
            OpenRailsError::CodeTooLong
        );
        require!(end_ts > start_ts, OpenRailsError::InvalidTimeWindow);

        let event = &mut ctx.accounts.event;
        event.organizer = ctx.accounts.organizer.key();
        event.creator = ctx.accounts.authority.key();
        event.name = name;
        event.uri = uri;
        event.start_ts = start_ts;
        event.end_ts = end_ts;
        event.claim_code = claim_code;
        event.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// PRA action type definition (PLANTED_TREE, CLEANUP_DONE, etc.)
    pub fn create_action_type(
        ctx: Context<CreateActionType>,
        code: String,
        name: String,
        uri: String,
        requires_evidence: bool,
    ) -> Result<()> {
        require!(
            code.as_bytes().len() <= MAX_ACTION_CODE,
            OpenRailsError::CodeTooLong
        );
        require!(
            name.as_bytes().len() <= MAX_NAME,
            OpenRailsError::NameTooLong
        );
        require!(uri.as_bytes().len() <= MAX_URI, OpenRailsError::UriTooLong);

        let action_type = &mut ctx.accounts.action_type;
        action_type.organizer = ctx.accounts.organizer.key();
        action_type.creator = ctx.accounts.authority.key();
        action_type.code = code;
        action_type.name = name;
        action_type.uri = uri;
        action_type.requires_evidence = requires_evidence;
        action_type.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Unified claim submission:
    /// - POA: claim_kind=AttendedEvent, provide `event` + `event_claim_code`
    /// - PRA: claim_kind=RealWorldAction, provide `action_type` + evidence/location/context
    pub fn submit_claim(
        ctx: Context<SubmitClaim>,
        claim_kind: ClaimKind,
        event_claim_code: Option<String>,
        evidence_hash: Option<String>,
        location_cell: Option<String>,
        context: Option<String>,
        occurred_ts: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        // permissive drift: allow up to 1 hour in the future (bad clocks)
        require!(
            occurred_ts <= now + 3600,
            OpenRailsError::OccurredTimeInFuture
        );

        if let Some(c) = &context {
            require!(
                c.as_bytes().len() <= MAX_CONTEXT,
                OpenRailsError::ContextTooLong
            );
        }
        if let Some(h) = &evidence_hash {
            require!(
                h.as_bytes().len() <= MAX_EVIDENCE_HASH,
                OpenRailsError::EvidenceTooLong
            );
        }
        if let Some(l) = &location_cell {
            require!(
                l.as_bytes().len() <= MAX_LOCATION_CELL,
                OpenRailsError::LocationTooLong
            );
        }

        let claim = &mut ctx.accounts.claim;
        claim.claimant = ctx.accounts.claimant.key();
        claim.organizer = ctx.accounts.organizer.key();
        claim.kind = claim_kind.clone();
        claim.occurred_ts = occurred_ts;
        claim.submitted_at = now;
        claim.status = ClaimStatus::Pending;
        claim.validator = Pubkey::default();

        match claim_kind {
            ClaimKind::AttendedEvent => {
                let event_ai = ctx
                    .accounts
                    .event
                    .as_ref()
                    .ok_or(OpenRailsError::MissingEvent)?
                    .to_account_info();

                require_keys_eq!(
                    *event_ai.owner,
                    crate::ID,
                    OpenRailsError::InvalidAccountOwner
                );

                let event_key = event_ai.key();

                let (event_start_ts, event_end_ts, event_claim_code_on_chain) = {
                    let data = event_ai.try_borrow_data()?;
                    let mut data_slice: &[u8] = &data;
                    let event_state = Event::try_deserialize(&mut data_slice)?;
                    (
                        event_state.start_ts,
                        event_state.end_ts,
                        event_state.claim_code,
                    )
                };

                require!(
                    occurred_ts >= event_start_ts && occurred_ts <= event_end_ts,
                    OpenRailsError::OutsideEventWindow
                );

                let provided = event_claim_code.ok_or(OpenRailsError::MissingClaimCode)?;
                require!(
                    provided == event_claim_code_on_chain,
                    OpenRailsError::InvalidClaimCode
                );

                claim.event = event_key;
                claim.action_type = Pubkey::default();
                claim.evidence_hash = None;
                claim.location_cell = None;
                claim.context = None;
            }
            ClaimKind::RealWorldAction => {
                let action_type_ai = ctx
                    .accounts
                    .action_type
                    .as_ref()
                    .ok_or(OpenRailsError::MissingActionType)?
                    .to_account_info();

                require_keys_eq!(
                    *action_type_ai.owner,
                    crate::ID,
                    OpenRailsError::InvalidAccountOwner
                );

                let action_type_key = action_type_ai.key();

                let action_type_requires_evidence = {
                    let data = action_type_ai.try_borrow_data()?;
                    let mut data_slice: &[u8] = &data;
                    let action_type_state = ActionType::try_deserialize(&mut data_slice)?;
                    action_type_state.requires_evidence
                };

                if action_type_requires_evidence {
                    require!(
                        evidence_hash.is_some(),
                        OpenRailsError::EvidenceRequired
                    );
                }

                claim.event = Pubkey::default();
                claim.action_type = action_type_key;
                claim.evidence_hash = evidence_hash;
                claim.location_cell = location_cell;
                claim.context = context;
            }
        }

        Ok(())
    }

    /// Organizer approves claim -> canonical Proof record
    pub fn approve_claim(ctx: Context<ApproveClaim>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        let claim = &mut ctx.accounts.claim;
        require!(
            claim.status == ClaimStatus::Pending,
            OpenRailsError::ClaimNotPending
        );

        // MVP: only organizer authority can approve
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.organizer.authority,
            OpenRailsError::Unauthorized
        );

        claim.status = ClaimStatus::Approved;
        claim.validator = ctx.accounts.authority.key();

        let proof = &mut ctx.accounts.proof;
        proof.claimant = claim.claimant;
        proof.organizer = claim.organizer;
        proof.validator = claim.validator;
        proof.kind = claim.kind.clone();

        proof.occurred_ts = claim.occurred_ts;
        proof.issued_at = now;

        proof.event = claim.event;
        proof.action_type = claim.action_type;

        proof.evidence_hash = claim.evidence_hash.clone();
        proof.location_cell = claim.location_cell.clone();
        proof.context = claim.context.clone();

        // Optional badge metadata (NFT/cNFT later)
        proof.badge_mint = Pubkey::default();
        proof.badge_uri = None;

        Ok(())
    }

    /// Optional: after minting NFT/cNFT elsewhere, attach badge refs to a proof
    pub fn attach_badge(
        ctx: Context<AttachBadge>,
        badge_mint: Pubkey,
        badge_uri: String,
    ) -> Result<()> {
        require!(
            badge_uri.as_bytes().len() <= MAX_URI,
            OpenRailsError::UriTooLong
        );

        let proof = &mut ctx.accounts.proof;

        // Keep MVP simple: only validator who approved can attach
        require_keys_eq!(
            ctx.accounts.authority.key(),
            proof.validator,
            OpenRailsError::Unauthorized
        );

        proof.badge_mint = badge_mint;
        proof.badge_uri = Some(badge_uri);
        Ok(())
    }
}

/* ----------------------------- Accounts ----------------------------- */

#[derive(Accounts)]
pub struct CreateOrganizer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Organizer::INIT_SPACE,
        seeds = [b"organizer", authority.key().as_ref()],
        bump
    )]
    pub organizer: Account<'info, Organizer>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"organizer", authority.key().as_ref()],
        bump
    )]
    pub organizer: Account<'info, Organizer>,

    #[account(
        init,
        payer = authority,
        space = 8 + Event::INIT_SPACE,
        seeds = [b"event", organizer.key().as_ref(), event_id.key().as_ref()],
        bump
    )]
    pub event: Account<'info, Event>,

    /// CHECK: This is a client-generated random pubkey used only as a PDA seed component
    /// to make each event unique. No data is read from this account.
    pub event_id: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateActionType<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"organizer", authority.key().as_ref()],
        bump
    )]
    pub organizer: Account<'info, Organizer>,

    #[account(
        init,
        payer = authority,
        space = 8 + ActionType::INIT_SPACE,
        seeds = [b"action_type", organizer.key().as_ref(), code_seed.key().as_ref()],
        bump
    )]
    pub action_type: Account<'info, ActionType>,

    /// CHECK: This is a client-provided pubkey used only as a PDA seed component
    /// to avoid collisions between action types. No data is read from this account.
    pub code_seed: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitClaim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,

    /// Organizer PDA derived from organizer_authority
    #[account(
        seeds = [b"organizer", organizer_authority.key().as_ref()],
        bump
    )]
    pub organizer: Account<'info, Organizer>,

    /// CHECK: Used only to derive the organizer PDA seeds. No data is read from this account.
    pub organizer_authority: UncheckedAccount<'info>,

    /// CHECK: Optional event account for POA.
    /// Validated manually inside submit_claim when claim_kind = AttendedEvent.
    pub event: Option<UncheckedAccount<'info>>,

    /// CHECK: Optional action type account for PRA.
    /// Validated manually inside submit_claim when claim_kind = RealWorldAction.
    pub action_type: Option<UncheckedAccount<'info>>,

    #[account(
        init,
        payer = claimant,
        space = 8 + Claim::INIT_SPACE,
        seeds = [
            b"claim",
            organizer.key().as_ref(),
            claimant.key().as_ref(),
            claim_id.key().as_ref()
        ],
        bump
    )]
    pub claim: Account<'info, Claim>,

    /// CHECK: Client-generated random pubkey used only as a PDA seed component
    /// to make each claim unique. No data is read from this account.
    pub claim_id: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveClaim<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"organizer", authority.key().as_ref()],
        bump
    )]
    pub organizer: Account<'info, Organizer>,

    #[account(mut)]
    pub claim: Account<'info, Claim>,

    #[account(
        init,
        payer = authority,
        space = 8 + Proof::INIT_SPACE,
        seeds = [
            b"proof",
            claim.organizer.as_ref(),
            claim.claimant.as_ref(),
            claim.key().as_ref()
        ],
        bump
    )]
    pub proof: Account<'info, Proof>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AttachBadge<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub proof: Account<'info, Proof>,
}

/* ------------------------------ State ------------------------------ */

#[account]
pub struct Organizer {
    pub authority: Pubkey,
    pub name: String,
    pub created_at: i64,
}
impl Organizer {
    pub const INIT_SPACE: usize = 32 + (4 + MAX_NAME) + 8;
}

#[account]
pub struct Event {
    pub organizer: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub uri: String,
    pub start_ts: i64,
    pub end_ts: i64,
    pub claim_code: String,
    pub created_at: i64,
}
impl Event {
    pub const INIT_SPACE: usize = 32
        + 32
        + (4 + MAX_NAME)
        + (4 + MAX_URI)
        + 8
        + 8
        + (4 + MAX_EVENT_CODE)
        + 8;
}

#[account]
pub struct ActionType {
    pub organizer: Pubkey,
    pub creator: Pubkey,
    pub code: String,
    pub name: String,
    pub uri: String,
    pub requires_evidence: bool,
    pub created_at: i64,
}
impl ActionType {
    pub const INIT_SPACE: usize = 32
        + 32
        + (4 + MAX_ACTION_CODE)
        + (4 + MAX_NAME)
        + (4 + MAX_URI)
        + 1
        + 8;
}

#[account]
pub struct Claim {
    pub claimant: Pubkey,
    pub organizer: Pubkey,
    pub kind: ClaimKind,

    pub event: Pubkey,
    pub action_type: Pubkey,

    pub evidence_hash: Option<String>,
    pub location_cell: Option<String>,
    pub context: Option<String>,

    pub occurred_ts: i64,
    pub submitted_at: i64,

    pub status: ClaimStatus,
    pub validator: Pubkey,
}
impl Claim {
    pub const INIT_SPACE: usize = 32
        + 32
        + 1
        + 32
        + 32
        + (1 + 4 + MAX_EVIDENCE_HASH)
        + (1 + 4 + MAX_LOCATION_CELL)
        + (1 + 4 + MAX_CONTEXT)
        + 8
        + 8
        + 1
        + 32;
}

#[account]
pub struct Proof {
    pub claimant: Pubkey,
    pub organizer: Pubkey,
    pub validator: Pubkey,
    pub kind: ClaimKind,

    pub occurred_ts: i64,
    pub issued_at: i64,

    pub event: Pubkey,
    pub action_type: Pubkey,

    pub evidence_hash: Option<String>,
    pub location_cell: Option<String>,
    pub context: Option<String>,

    pub badge_mint: Pubkey,
    pub badge_uri: Option<String>,
}
impl Proof {
    pub const INIT_SPACE: usize = 32
        + 32
        + 32
        + 1
        + 8
        + 8
        + 32
        + 32
        + (1 + 4 + MAX_EVIDENCE_HASH)
        + (1 + 4 + MAX_LOCATION_CELL)
        + (1 + 4 + MAX_CONTEXT)
        + 32
        + (1 + 4 + MAX_URI);
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ClaimKind {
    AttendedEvent,
    RealWorldAction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ClaimStatus {
    Pending,
    Approved,
    Rejected,
}

/* ------------------------------ Errors ------------------------------ */

#[error_code]
pub enum OpenRailsError {
    #[msg("Name too long")]
    NameTooLong,
    #[msg("URI too long")]
    UriTooLong,
    #[msg("Code too long")]
    CodeTooLong,
    #[msg("Invalid time window")]
    InvalidTimeWindow,
    #[msg("Occurred time is too far in the future")]
    OccurredTimeInFuture,
    #[msg("Missing event account for attendance claim")]
    MissingEvent,
    #[msg("Missing action type account for action claim")]
    MissingActionType,
    #[msg("Missing claim code")]
    MissingClaimCode,
    #[msg("Invalid claim code")]
    InvalidClaimCode,
    #[msg("Outside event window")]
    OutsideEventWindow,
    #[msg("Evidence required for this action type")]
    EvidenceRequired,
    #[msg("Context too long")]
    ContextTooLong,
    #[msg("Evidence hash too long")]
    EvidenceTooLong,
    #[msg("Location cell too long")]
    LocationTooLong,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Claim is not pending")]
    ClaimNotPending,
    #[msg("Branch account is owned by the wrong program")]
    InvalidAccountOwner,
}