import { Link } from "wouter";

export default function Shop() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Shop</h1>
      <p className="text-muted-foreground mb-4">This page is being migrated.</p>
      <Link href="/" className="text-primary underline">← Home</Link>
    </div>
  );
}
