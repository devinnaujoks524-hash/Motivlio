import { saveSettings } from "@/app/actions/settings";
import { ActionForm } from "@/components/form";
import { Card, Field, PageHeader, inputCls } from "@/components/ui";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const { business, user } = await requireBusiness();
  return (
    <>
      <PageHeader title="Betriebseinstellungen" />
      <Card>
        <ActionForm action={saveSettings} submit="Speichern" encType="multipart/form-data">
          <Field label="Firmenname" htmlFor="name"><input id="name" name="name" required defaultValue={business.name} className={inputCls} /></Field>
          <Field label="Antwortadresse" htmlFor="reply_to_email" hint={`Antworten des Kunden auf Einladungen gehen hierhin. Leer = ${user.email}.`}>
            <input id="reply_to_email" name="reply_to_email" type="email" defaultValue={business.reply_to_email ?? ""} className={inputCls} />
          </Field>
          <Field label="Logo (PNG oder JPG, max. 2 MB)" htmlFor="logo" hint={business.logo_path ? "Ein Logo ist hinterlegt. Eine neue Datei ersetzt es." : "Erscheint in der Kundenansicht."}>
            <input id="logo" name="logo" type="file" accept="image/png,image/jpeg" className={inputCls} />
          </Field>
        </ActionForm>
      </Card>
    </>
  );
}
