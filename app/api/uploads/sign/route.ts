import { POST as directUploadPost } from "../../images/direct-upload/route";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return directUploadPost(req);
}
