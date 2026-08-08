import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratedBlogPost } from "../blog/generateBlogPost.js";

export async function writeBlogPost(
  post: GeneratedBlogPost,
): Promise<string> {
  const outputDirectory = path.join(
    process.cwd(),
    "output",
    "blog",
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const outputPath = path.join(
    outputDirectory,
    post.filename,
  );

  await fs.writeFile(
    outputPath,
    post.markdown,
    "utf8",
  );

  return outputPath;
}