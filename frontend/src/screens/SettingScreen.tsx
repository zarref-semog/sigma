import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, isAdmin } from "../api";
import { Button } from "../components/Button";

type Settings = {
  minimumBattery: number;
  schedulerIntervalSeconds: number;
  robotStepIntervalMs: number;
  automaticReturnToCharge: boolean;
};

const defaults: Settings = {
  minimumBattery: 20,
  schedulerIntervalSeconds: 5,
  robotStepIntervalMs: 250,
  automaticReturnToCharge: true,
};

export function SettingScreen() {
  const admin = isAdmin();
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/settings")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(
              new Error("Não foi possível carregar as configurações."),
            ),
      )
      .then((data) =>
        setSettings({
          minimumBattery: Number(data.minimumBattery),
          schedulerIntervalSeconds: Number(data.schedulerIntervalSeconds),
          robotStepIntervalMs: Number(data.robotStepIntervalMs),
          automaticReturnToCharge: Boolean(data.automaticReturnToCharge),
        }),
      )
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  function numberField(
    field: keyof Pick<
      Settings,
      "minimumBattery" | "schedulerIntervalSeconds" | "robotStepIntervalMs"
    >,
    value: string,
  ) {
    setSettings((current) => ({ ...current, [field]: Number(value) }));
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.message || "Não foi possível salvar as configurações.",
        );
      setSettings(body);
      setMessage("Configurações salvas e aplicadas aos próximos roteiros.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Erro ao salvar as configurações.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="screen-heading">
        <h1>Configurações</h1>
      </div>
      {error && (
        <p className="project-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="settings-success" role="status">
          {message}
        </p>
      )}
      <form className="settings-form" onSubmit={save}>
        <section className="settings-card">
          <label className="settings-field">
            <span>Bateria mínima</span>
            <div className="settings-number">
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={settings.minimumBattery}
                disabled={!admin || loading}
                onChange={(event) =>
                  numberField("minimumBattery", event.target.value)
                }
              />
              <b>%</b>
            </div>
          </label>
          <label className="settings-field">
            <span>Intervalo de verificação</span>
            <div className="settings-number">
              <input
                className="input"
                type="number"
                min="1"
                max="300"
                value={settings.schedulerIntervalSeconds}
                disabled={!admin || loading}
                onChange={(event) =>
                  numberField("schedulerIntervalSeconds", event.target.value)
                }
              />
              <b>s</b>
            </div>
          </label>
          <label className="settings-field">
            <span>Tempo-base por etapa</span>
            <div className="settings-number">
              <input
                className="input"
                type="number"
                min="50"
                max="5000"
                step="50"
                value={settings.robotStepIntervalMs}
                disabled={!admin || loading}
                onChange={(event) =>
                  numberField("robotStepIntervalMs", event.target.value)
                }
              />
              <b>ms</b>
            </div>
          </label>
          <label className="settings-toggle">
            <span>Retorno automático à zona de carga</span>
            <input
              type="checkbox"
              checked={settings.automaticReturnToCharge}
              disabled={!admin || loading}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  automaticReturnToCharge: event.target.checked,
                })
              }
            />
            <i />
          </label>
          <div className="settings-actions">
            {!admin && (
              <span>
                Somente administradores podem alterar estes parâmetros.
              </span>
            )}
            {admin && (
              <>
                <Button
                  type="button"
                  className="button button-outlined"
                  onClick={() => setSettings(defaults)}
                  disabled={loading || saving}
                >
                  Restaurar
                </Button>
                <Button
                  type="submit"
                  className="button button-success"
                  disabled={loading || saving}
                >
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </>
            )}
          </div>
        </section>
      </form>
    </>
  );
}
