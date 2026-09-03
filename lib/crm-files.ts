export type StoredCrmFile = {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  mimeType?: string;
};

export type CrmFileTarget = {
  clientId: string;
  subitemId?: string;
};

export async function uploadCrmFiles(
  files: File[],
  scope: string,
  target: CrmFileTarget,
): Promise<StoredCrmFile[]> {
  return Promise.all(files.map(async (file) => {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("scope", scope);
    formData.set("clientId", target.clientId);
    if (target.subitemId) formData.set("subitemId", target.subitemId);
    const response = await fetch("/api/files/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `Could not upload ${file.name}`);
    return result.file as StoredCrmFile;
  }));
}
