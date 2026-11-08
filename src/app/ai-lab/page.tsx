import { notFound } from "next/navigation";
import { AssistantLab } from "./assistant-lab";

export default function AssistantLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <AssistantLab />;
}
