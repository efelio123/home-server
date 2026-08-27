import { useState, type FormEvent } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";

import { createStore } from "../api/client";
import type { Store } from "../api/types";
import "../styles/forms.css";

interface CreateStoreDialogProps {
  visible: boolean;
  onHide: () => void;
  onCreated: (store: Store) => void;
}

export function CreateStoreDialog({ visible, onHide, onCreated }: CreateStoreDialogProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleHide() {
    setName("");
    setErrorMessage(null);
    onHide();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Enter a store name.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      onCreated(await createStore(name.trim()));
      handleHide();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the store.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog header="Add store" modal style={{ width: "min(28rem, 95vw)" }} visible={visible} onHide={handleHide}>
      <form className="form-dialog" onSubmit={handleSubmit}>
        {errorMessage && <Message severity="error" text={errorMessage} />}
        <div className="form-dialog__field">
          <FloatLabel>
            <InputText id="store-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
            <label htmlFor="store-name">Store name</label>
          </FloatLabel>
        </div>
        <div className="form-dialog__actions">
          <Button label="Cancel" severity="secondary" outlined type="button" disabled={isSubmitting} onClick={handleHide} />
          <Button label="Add store" icon="pi pi-check" loading={isSubmitting} type="submit" />
        </div>
      </form>
    </Dialog>
  );
}
