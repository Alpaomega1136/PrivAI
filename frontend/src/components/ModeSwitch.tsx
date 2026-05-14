import { ChevronDown } from "lucide-react";

import { AppMode } from "../lib/navigation";

export function ModeSwitch({
  appMode,
  onModeChange,
}: {
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}) {
  return (
    <label className="mode-switch">
      <span className="mode-switch-label">User Mode:</span>
      <span className="mode-switch-control">
        <select value={appMode} onChange={(event) => onModeChange(event.target.value as AppMode)}>
          <option value="user">USER</option>
          <option value="government">GOVERNMENT</option>
        </select>
        <ChevronDown size={16} />
      </span>
    </label>
  );
}
