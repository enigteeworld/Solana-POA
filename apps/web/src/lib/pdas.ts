import { PublicKey } from "@solana/web3.js";
import { OPEN_RAILS_PROGRAM_ID } from "@/lib/solana";

export async function organizerPda(authority: PublicKey) {
  return PublicKey.findProgramAddress(
    [Buffer.from("organizer"), authority.toBuffer()],
    OPEN_RAILS_PROGRAM_ID
  );
}

export async function eventPda(organizer: PublicKey, eventId: PublicKey) {
  return PublicKey.findProgramAddress(
    [Buffer.from("event"), organizer.toBuffer(), eventId.toBuffer()],
    OPEN_RAILS_PROGRAM_ID
  );
}

export async function actionTypePda(organizer: PublicKey, codeSeed: PublicKey) {
  return PublicKey.findProgramAddress(
    [Buffer.from("action_type"), organizer.toBuffer(), codeSeed.toBuffer()],
    OPEN_RAILS_PROGRAM_ID
  );
}

export async function claimPda(
  organizer: PublicKey,
  claimant: PublicKey,
  claimId: PublicKey
) {
  return PublicKey.findProgramAddress(
    [
      Buffer.from("claim"),
      organizer.toBuffer(),
      claimant.toBuffer(),
      claimId.toBuffer(),
    ],
    OPEN_RAILS_PROGRAM_ID
  );
}