"use client";

import { JSONValue } from "llamaindex";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { DocumentFile, MessageAnnotation, MessageAnnotationType } from "..";
import { useClientConfig } from "./use-config";

export function useFile() {
  const { backend } = useClientConfig();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<DocumentFile[]>([]);

  const docEqual = (a: DocumentFile, b: DocumentFile) => {
    if (a.id === b.id) return true;
    if (a.filename === b.filename && a.filesize === b.filesize) return true;
    return false;
  };

  const addDoc = (file: DocumentFile) => {
    const existedFile = files.find((f) => docEqual(f, file));
    if (!existedFile) {
      setFiles((prev) => [...prev, file]);
      return true;
    }
    return false;
  };

  const removeDoc = (file: DocumentFile) => {
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  };

  const reset = () => {
    imageUrl && setImageUrl(null);
    files.length && setFiles([]);
  };

  const getPdfDetail = async (
    pdfBase64: string,
  ): Promise<Pick<DocumentFile, "content" | "embeddings">> => {
    const embedAPI = `${backend}/api/chat/embed`;
    const response = await fetch(embedAPI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdf: pdfBase64,
      }),
    });
    if (!response.ok) throw new Error("Failed to get pdf detail");
    const data = await response.json();
    return data;
  };

  const getAnnotations = () => {
    const annotations: MessageAnnotation[] = [];
    if (imageUrl) {
      annotations.push({
        type: MessageAnnotationType.IMAGE,
        data: { url: imageUrl },
      });
    }
    if (files.length > 0) {
      annotations.push({
        type: MessageAnnotationType.DOCUMENT_FILE,
        data: { files },
      });
    }
    return annotations as JSONValue[];
  };

  const readContent = async (input: {
    file: File;
    asUrl?: boolean;
  }): Promise<string> => {
    const { file, asUrl } = input;
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      if (asUrl) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
    return content;
  };

  const uploadFile = async (file: File) => {
    if (file.type.startsWith("image/")) {
      const base64 = await readContent({ file, asUrl: true });
      return setImageUrl(base64);
    }
    switch (file.type) {
      case "text/csv": {
        const content = await readContent({ file });
        return addDoc({
          id: uuidv4(),
          filetype: "csv",
          filename: file.name,
          filesize: file.size,
          content,
        });
      }
      case "application/pdf": {
        const base64 = await readContent({ file, asUrl: true });
        const pdfDetail = await getPdfDetail(base64);
        return addDoc({
          id: uuidv4(),
          filetype: "pdf",
          filename: file.name,
          filesize: file.size,
          content: pdfDetail.content,
          embeddings: pdfDetail.embeddings,
        });
      }
    }
  };

  const alreadyUploaded = imageUrl || files.length > 0;

  return {
    imageUrl,
    setImageUrl,
    files,
    removeDoc,
    reset,
    getAnnotations,
    alreadyUploaded,
    uploadFile,
  };
}
