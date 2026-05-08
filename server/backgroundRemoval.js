import fs from "fs";
import path from "path";
import { removeBackground } from "@imgly/background-removal-node";
import { state, persistCutoutState } from "./state.js";
import { buildImageName } from "./utils.js";
import { cutoutsDir } from "./config.js";
export async function runBackgroundRemoval(inputPath, outputPath) {
  const inputUrl = pathToFileURL(inputPath).href;
  const blob = await removeBackground(inputUrl, {
    output: {
      format: "image/png",
    },
  });
  const bytes = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(outputPath, bytes);

  if (!fs.existsSync(outputPath)) {
    throw new Error("O removedor de fundo terminou sem gerar arquivo de saida.");
  }
}

export async function removeBackgroundFromReferenceImage(referenceImage) {
  const inputExtension = mimeTypeToExtension(referenceImage.mimeType);
  const tempDir = path.join(dataDir, "tmp");
  fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(
    tempDir,
    `reference-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${inputExtension}`
  );
  const outputPath = path.join(
    tempDir,
    `reference-output-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  );

  try {
    fs.writeFileSync(inputPath, referenceImage.buffer);
    await runBackgroundRemoval(inputPath, outputPath);

    const outputBuffer = fs.readFileSync(outputPath);
    return {
      name: `${path.basename(referenceImage.name, path.extname(referenceImage.name || "")) || "referencia"}-sem-fundo.png`,
      mimeType: "image/png",
      data: outputBuffer.toString("base64"),
      size: outputBuffer.length,
    };
  } finally {
    removeFileIfPresent(inputPath);
    removeFileIfPresent(outputPath);
  }
}

