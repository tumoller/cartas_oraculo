import { notFound } from "next/navigation";
import Preview from "../../../tests/preview-consultation";

// Dev preview page for ui check
export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Preview />;
}
