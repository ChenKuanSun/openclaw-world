import type { RoomInfoMessage } from "../../server/types.js";

export interface RoomInfoBarAPI {
  update(info: RoomInfoMessage): void;
}

export function setupRoomInfoBar(): RoomInfoBarAPI {
  const bar = document.getElementById("room-info-bar")!;

  function update(info: RoomInfoMessage): void {
    bar.textContent = "";
    bar.classList.add("visible");

    const name = document.createElement("span");
    name.className = "rib-name";
    name.textContent = info.name;
    bar.appendChild(name);

    if (info.description) {
      const desc = document.createElement("span");
      desc.className = "rib-desc";
      desc.textContent = info.description;
      bar.appendChild(desc);
    }

    bar.appendChild(createSep());

    const idWrap = document.createElement("span");
    idWrap.className = "rib-id";
    idWrap.textContent = `ID: ${info.roomId}`;

    const copyBtn = document.createElement("button");
    copyBtn.className = "rib-copy";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(info.roomId).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
      });
    });
    idWrap.appendChild(copyBtn);
    bar.appendChild(idWrap);

    bar.appendChild(createSep());

    const agents = document.createElement("span");
    agents.className = "rib-agents";
    agents.textContent = `${info.agents}/${info.maxAgents} agents`;
    bar.appendChild(agents);
  }

  function createSep(): HTMLSpanElement {
    const sep = document.createElement("span");
    sep.className = "rib-sep";
    sep.textContent = "|";
    return sep;
  }

  return { update };
}
