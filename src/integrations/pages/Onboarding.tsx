import { useEffect, useMemo, useState } from "react";
import { Cable, Check, ChevronLeft, ChevronRight, Cpu, Globe2, Network, Plus, RadioTower, Router, ShieldCheck, Wifi, X } from "lucide-react";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import "../onboarding.css";

type GatewayStatus = "ready" | "provisioning";
interface Gateway { id: string; model: string; name: string; network: string; progress: number; serial: string; status: GatewayStatus; }

const models = [
  { id: "prpl-os", name: "prplOS Edge Gateway", description: "Dual-WAN edge gateway for secure IPsec connectivity.", detail: "2.5 GbE · Wi-Fi 6 · VPN", icon: Router },
  { id: "rdk-b", name: "RDK-B Branch Gateway", description: "Managed branch appliance with cellular failover.", detail: "5G · 4 LAN ports · PoE", icon: RadioTower },
  { id: "industrial", name: "Industrial Edge Node", description: "DIN-rail gateway for PLC and OT network segments.", detail: "RS485 · Ethernet · MQTT", icon: Cpu },
] as const;
const steps = [{ label: "Gateway", icon: Router }, { label: "Identity", icon: ShieldCheck }, { label: "Network", icon: Network }, { label: "Review", icon: Check }] as const;

function progressMessage(progress: number) {
  if (progress < 25) return "Connecting to gateway";
  if (progress < 52) return "Downloading configuration";
  if (progress < 78) return "Applying secure network policy";
  if (progress < 100) return "Verifying connectivity";
  return "Gateway ready";
}

export function OnboardingPage({ branchId }: { branchId: "b-mck-03" | "b-pln-01" }) {
  const [mode, setMode] = useState<"list" | "form">("list");
  const [step, setStep] = useState(0);
  const [modelId, setModelId] = useState<(typeof models)[number]["id"]>(models[0].id);
  const [name, setName] = useState("SF-EDGE-02");
  const [serial, setSerial] = useState("PRPL-SF-042");
  const [networkName, setNetworkName] = useState("Factory operations");
  const [wanMode, setWanMode] = useState<"dhcp" | "static">("dhcp");
  const [wanAddress, setWanAddress] = useState("10.30.0.24");
  const [gateways, setGateways] = useState<Gateway[]>([{ id: "sf-gw-01", model: "prplOS Edge Gateway", name: "SF-EDGE-01", network: "Factory operations", progress: 100, serial: "PRPL-SF-001", status: "ready" }]);

  useEffect(() => {
    if (!gateways.some((gateway) => gateway.status === "provisioning")) return;
    const timer = window.setInterval(() => setGateways((current) => current.map((gateway) => {
      if (gateway.status !== "provisioning") return gateway;
      const progress = Math.min(100, gateway.progress + 13);
      return { ...gateway, progress, status: progress === 100 ? "ready" : "provisioning" };
    })), 900);
    return () => window.clearInterval(timer);
  }, [gateways]);

  const model = useMemo(() => models.find((candidate) => candidate.id === modelId) ?? models[0], [modelId]);
  const location = branchId === "b-mck-03" ? "McKinney plant" : "Plano plant";
  const reset = () => { setStep(0); setModelId(models[0].id); setName("SF-EDGE-02"); setSerial("PRPL-SF-042"); setNetworkName("Factory operations"); setWanMode("dhcp"); setWanAddress("10.30.0.24"); };
  const openForm = () => { reset(); setMode("form"); };
  const start = () => {
    setGateways((current) => [{ id: "sf-gw-" + Date.now(), model: model.name, name: name.trim() || "Unnamed gateway", network: networkName.trim() || "Factory operations", progress: 8, serial: serial.trim() || "Pending assignment", status: "provisioning" }, ...current]);
    setMode("list"); reset();
  };

  if (mode === "form") {
    return <div className="onboarding-page">
      <PageHeader title="Gateway onboarding" subtitle={"Provision a secure gateway for " + location + " · " + branchId + "/ipsec/metrics"} right={<button type="button" onClick={() => setMode("list")}><X size={14} />Cancel</button>} />
      <div className="onboarding-shell">
        <nav className="onboarding-steps" aria-label="Gateway onboarding steps">
          {steps.map((item, index) => { const Icon = item.icon; const className = "onboarding-step" + (index === step ? " is-active" : "") + (index < step ? " is-complete" : ""); return <div key={item.label} className={className}><span className="onboarding-step__icon">{index < step ? <Check size={14} /> : <Icon size={14} />}</span><span>{item.label}</span></div>; })}
        </nav>
        <Card title={steps[step].label} sub={step === 0 ? "Choose the hardware profile that will join the plant network." : step === 1 ? "Give the gateway a recognizable identity for operations teams." : step === 2 ? "Set the primary uplink that carries gateway telemetry." : "Review the provisioning plan before it is applied."}>
          {step === 0 && <div className="onboarding-models">{models.map((candidate) => { const Icon = candidate.icon; const selected = candidate.id === modelId; return <button key={candidate.id} type="button" className={"onboarding-model" + (selected ? " is-selected" : "")} onClick={() => setModelId(candidate.id)} aria-pressed={selected}><span className="onboarding-model__icon"><Icon size={20} /></span><strong>{candidate.name}</strong><span>{candidate.description}</span><small>{candidate.detail}</small></button>; })}</div>}
          {step === 1 && <div className="onboarding-fields"><label><span>Gateway name</span><input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label><label><span>Serial number</span><input value={serial} onChange={(event) => setSerial(event.target.value)} /></label><label><span>Plant network</span><input value={networkName} onChange={(event) => setNetworkName(event.target.value)} /></label></div>}
          {step === 2 && <div className="onboarding-network"><button type="button" className={"onboarding-network__option" + (wanMode === "dhcp" ? " is-selected" : "")} onClick={() => setWanMode("dhcp")} aria-pressed={wanMode === "dhcp"}><Wifi size={18} /><span><strong>DHCP uplink</strong><small>Obtain address and DNS from the plant network.</small></span></button><button type="button" className={"onboarding-network__option" + (wanMode === "static" ? " is-selected" : "")} onClick={() => setWanMode("static")} aria-pressed={wanMode === "static"}><Cable size={18} /><span><strong>Static address</strong><small>Use an approved fixed address for the gateway.</small></span></button>{wanMode === "static" && <label className="onboarding-network__address"><span>WAN address</span><input value={wanAddress} onChange={(event) => setWanAddress(event.target.value)} /></label>}</div>}
          {step === 3 && <div className="onboarding-review"><Review label="Gateway model" value={model.name} /><Review label="Gateway name" value={name || "Unnamed gateway"} /><Review label="Serial number" value={serial || "Pending assignment"} /><Review label="Plant network" value={networkName || "Factory operations"} /><Review label="Primary uplink" value={wanMode === "dhcp" ? "DHCP uplink" : "Static · " + wanAddress} /><div className="onboarding-review__notice"><ShieldCheck size={16} />This will apply the gateway network profile and begin provisioning.</div></div>}
          <div className="onboarding-actions"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ChevronLeft size={15} />Back</button>{step < steps.length - 1 ? <button className="primary" type="button" onClick={() => setStep((current) => current + 1)}>Continue<ChevronRight size={15} /></button> : <button className="primary" type="button" onClick={start}><Globe2 size={15} />Start provisioning</button>}</div>
        </Card>
      </div>
    </div>;
  }

  return <div className="onboarding-page">
    <PageHeader title="Gateway onboarding" subtitle={"Securely provision branch gateways for " + location + " · " + branchId + "/ipsec/metrics"} right={<button className="primary" type="button" onClick={openForm}><Plus size={15} />Onboard gateway</button>} />
    <div className="onboarding-overview"><div><span className="onboarding-overview__eyebrow">Gateway management</span><strong>{gateways.length} gateway{gateways.length === 1 ? "" : "s"} in this plant</strong><span>Provision a new edge gateway or follow the live status of a gateway already being configured.</span></div><div className="onboarding-overview__visual" aria-hidden><Router size={34} /><span /><RadioTower size={28} /></div></div>
    <Card title="Onboarded gateways" sub="Gateway configuration is scoped to the active plant feed."><div className="onboarding-gateway-list">{gateways.map((gateway) => <div key={gateway.id} className="onboarding-gateway"><div className="onboarding-gateway__icon"><Router size={18} /></div><div className="onboarding-gateway__identity"><strong>{gateway.name}</strong><span>{gateway.model} · {gateway.serial}</span></div><div className="onboarding-gateway__network"><span>Network</span><strong>{gateway.network}</strong></div><div className="onboarding-gateway__status"><div><span className={"dot " + (gateway.status === "ready" ? "ok" : "warn")} /><strong>{gateway.status === "ready" ? "Ready" : progressMessage(gateway.progress)}</strong></div>{gateway.status === "provisioning" && <><div className="onboarding-progress"><span style={{ width: gateway.progress + "%" }} /></div><small>{gateway.progress}% · {progressMessage(gateway.progress)}</small></>}</div></div>)}</div></Card>
  </div>;
}

function Review({ label, value }: { label: string; value: string }) {
  return <div className="onboarding-review__row"><span>{label}</span><strong>{value}</strong></div>;
}
