import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { getHealth, getModelHealth } from "./lib/api";

type Health = Record<string, unknown>;

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [model, setModel] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getHealth(), getModelHealth()])
      .then(([healthData, modelData]) => {
        setHealth(healthData);
        setModel(modelData);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="mark"><ShieldCheck size={32} /></div>
        <p className="eyebrow">Local-first visual firewall</p>
        <h1>PrivAI</h1>
        <p className="lead">
          Skeleton Docker environment untuk backend FastAPI dan frontend Vite. Pipeline deteksi, redaksi, vault, dan audit bisa ditambahkan di struktur ini.
        </p>
        <div className="grid">
          <StatusCard title="Backend" data={health} error={error} />
          <StatusCard title="Model" data={model} error={error} />
        </div>
      </section>
    </main>
  );
}

function StatusCard({ title, data, error }: { title: string; data: Health | null; error: string | null }) {
  return (
    <article className="status-card">
      <h2>{title}</h2>
      {error ? <p className="error">{error}</p> : <pre>{JSON.stringify(data ?? { status: "loading" }, null, 2)}</pre>}
    </article>
  );
}

