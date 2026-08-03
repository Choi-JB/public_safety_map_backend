// 담당: 제보/알림팀
// 내용: 제보 이미지 얼굴 마스킹 (masking/mask_cli.py 호출)
import { spawn } from "child_process";
import path from "path";

const PYTHON = process.env.MASKING_PYTHON ?? "python";
const MASKING_DIR = path.join(process.cwd(), "masking");
const CLI = path.join(MASKING_DIR, "mask_cli.py");

/** 원본 Buffer → 마스킹 JPEG Buffer (원본은 디스크에 쓰지 않음) */
export function maskImageBuffer(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [CLI], {
      cwd: MASKING_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    child.stdout.on("data", (chunk) => out.push(chunk as Buffer));
    child.stderr.on("data", (chunk) => err.push(chunk as Buffer));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            Buffer.concat(err).toString("utf8").trim() || "masking failed",
          ),
        );
        return;
      }
      resolve(Buffer.concat(out));
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}