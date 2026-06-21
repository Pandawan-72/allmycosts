// receiptStorage.ts — Copie une photo de ticket (uri temporaire renvoyée par
// la caméra/galerie) vers un répertoire permanent de l'app, pour qu'elle
// survive aux redémarrages et au nettoyage de cache du système.

import * as FileSystem from "expo-file-system/legacy";

const RECEIPTS_DIR = `${FileSystem.documentDirectory}receipts/`;

async function ensureDirExists() {
  const info = await FileSystem.getInfoAsync(RECEIPTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECEIPTS_DIR, { intermediates: true });
  }
}

// Copie une image depuis son uri temporaire vers le stockage permanent de
// l'app, et retourne le nouveau chemin à stocker avec la dépense.
export async function saveReceiptImage(tempUri: string): Promise<string> {
  await ensureDirExists();
  const filename = `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const destUri = `${RECEIPTS_DIR}${filename}`;
  await FileSystem.copyAsync({ from: tempUri, to: destUri });
  return destUri;
}

// Écrit une image directement depuis des données base64 (utilisé lors de la
// restauration d'une sauvegarde, où les photos sont embarquées en base64
// plutôt que référencées par un chemin de fichier qui n'existe plus).
export async function saveReceiptImageFromBase64(base64: string): Promise<string> {
  await ensureDirExists();
  const filename = `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const destUri = `${RECEIPTS_DIR}${filename}`;
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destUri;
}

// Supprime une image de ticket du stockage permanent (utilisé quand une
// dépense associée est supprimée, pour ne pas accumuler de fichiers orphelins).
export async function deleteReceiptImage(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Échec silencieux : un fichier déjà absent ne doit pas bloquer la
    // suppression de la dépense elle-même.
  }
}
