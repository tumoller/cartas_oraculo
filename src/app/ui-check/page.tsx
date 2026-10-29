import { notFound } from "next/navigation";
import Preview from "../../../tests/preview-consultation";

export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Preview />;
}
