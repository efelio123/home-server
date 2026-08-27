import { useEffect, useState, type FormEvent } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";

import {
  createHouseholdMember,
  getHouseholdMembers,
  updateHouseholdMember,
} from "../api/client";
import type { HouseholdMember } from "../api/types";

import "./HouseholdMembersPage.css";

export default function HouseholdMembersPage() {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMembers() {
      try {
        setMembers(await getHouseholdMembers());
      } catch {
        setError("Unable to load household members.");
      }
    }
    void loadMembers();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const member = await createHouseholdMember(name.trim());
      setMembers((current) => [...current, member].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setName("");
    } catch {
      setError("Unable to add this household member.");
    }
  }

  async function handleArchive(member: HouseholdMember) {
    if (!window.confirm(`Archive ${member.display_name}?`)) return;
    try {
      const updated = await updateHouseholdMember(member.id, { is_active: false });
      setMembers((current) => current.filter((item) => item.id !== updated.id));
    } catch {
      setError("Unable to archive this household member.");
    }
  }

  return <section className="household-members-page">
    <div><h1>Household Members</h1><p>Manage the people available in meal planning.</p></div>
    {error && <Message severity="error" text={error} />}
    <form className="household-members-page__form" onSubmit={handleSubmit}>
      <InputText value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
      <Button label="Add member" icon="pi pi-plus" type="submit" />
    </form>
    <ul className="household-members-page__list">
      {members.map((member) => <li key={member.id}><span>{member.display_name}</span><Button label="Archive" icon="pi pi-trash" severity="danger" text onClick={() => void handleArchive(member)} /></li>)}
    </ul>
  </section>;
}
