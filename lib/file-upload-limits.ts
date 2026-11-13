/** Shared application limits. Storage bucket limits remain a separate backstop. */
export const STANDARD_FILE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function exceedsStandardFileUploadLimit(file: Pick<File, "size">) {
  return file.size > STANDARD_FILE_UPLOAD_MAX_BYTES;
}

export function standardFileUploadLimitMessage(subject = "Files") {
  return `${subject} must be 10 MB or smaller`;
}
