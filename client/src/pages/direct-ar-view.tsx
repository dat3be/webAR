import { DirectARViewer } from "@/components/DirectARViewer";

interface DirectARViewProps {
  projectId: string;
}

export default function DirectARView({ projectId }: DirectARViewProps) {
  return <DirectARViewer projectId={projectId} />;
}