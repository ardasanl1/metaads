import AssetDiagnosticsContent from "./AssetDiagnosticsContent";

export default function AssetDiagnosticsPage() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <AssetDiagnosticsContent />;
}
