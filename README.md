# OpenScript Panel (v0.1.0-beta)
> 🇮🇹 **Nota:** L'interfaccia del pannello e la documentazione sono attualmente disponibili in **Italiano**.

Un pannello moderno, gratuito e open-source per **Adobe Illustrator** progettato per organizzare, filtrare ed eseguire velocemente le tue librerie di script `.jsx` e `.js`.

<details>
  <summary>📸 <b>Clicca qui per sfogliare la Galleria Screenshot</b></summary>
  <br>
  <p align="center">
    <img src="https://github.com/user-attachments/assets/76a4320d-3c02-4bce-9920-defc1e21e1c6" width="50%" alt="Principale"><br>
    <i>Vista principale del pannello</i>
    <br><br>
    <img src="https://github.com/user-attachments/assets/2b44e50f-2a2b-4b43-89a9-d6f79a22a7b9" width="50%" alt="Cartelle"><br>
    <i>Cartelle</i>
    <br><br>
    <img src="https://github.com/user-attachments/assets/5720f549-2373-49ba-afcb-9410175d00f2" width="50%" alt="Preferiti"><br>
    <i>Preferiti</i>
    <br><br>
    <img src="https://github.com/user-attachments/assets/fe2e1486-e340-4b92-96b9-0ccd3888ee46" width="50%" alt="Cronologia"><br>
    <i>Cronologia</i>
    <br><br>
    <img src="https://github.com/user-attachments/assets/55125002-b108-4c39-8059-a8e39ddccf90" width="50%" alt="Tasto destro"><br>
    <i>Tasto destro / menu tre puntini</i>
    <br><br>
    <img src="https://github.com/user-attachments/assets/3e453761-1cd3-43a8-bac6-9d3578016874" width="50%" alt="Gestione Tag"><br>
    <i>Gestione Tag</i>
  </p>
</details>

---

## ✨ Funzionalità

- **Esecuzione in un clic:** Pulsanti di avvio per tutti gli script.
- **Selezione Marquee:** Drag-to-select per selezionare e spostare più script o cartelle contemporaneamente.
- **Menu Contestuale:** Clic con il tasto destro per rinominare, gestire tag, aprire la posizione file o eliminare.
- **Organizzazione Flessibile:** Cartelle virtuali, tag personalizzati, lista dei preferiti e cronologia.

---

## 🚀 Installazione

### 🪟 Windows

#### Opzione A: Installatore Automatico `.exe` (Consigliato)

1. Vai nella sezione [**Releases**](../../releases/latest) della repository e scarica il file `OpenScriptPanel_Setup_v0.1.0_Beta.exe`.

2. Assicurati che Adobe Illustrator sia chiuso.

3. Esegui il file `.exe` con un doppio clic e completa l'installazione.

4. Apri Illustrator: troverai il pannello sotto **Finestra > Estensioni > OpenScript Panel**.

#### Opzione B: Installazione Manuale

1. Scarica e scompatta il codice sorgente o il file `.zip` della release.

2. Copia l'intera cartella dell'estensione (`com.custom.openscriptpanel`) nella directory CEP di Windows:

   ```
   C:\Users\<TuoNomeUtente>\AppData\Roaming\Adobe\CEP\extensions\
   
   ```

   *(Puoi accedere velocemente premendo `Win + R`, digitando `%appdata%\Adobe\CEP\extensions` e premendo Invio).*

3. **Abilita la modalità debug CEP:**

   * Premi `Win + R`, digita `regedit` e premi Invio per aprire il Registro di Sistema.

   * Vai nel percorso `HKEY_CURRENT_USER\Software\Adobe\CSXS.11` *(o la versione corrispondente al tuo Illustrator, es. CSXS.10 o CSXS.12)*.

   * Crea un valore stringa (**String Value**) chiamato `PlayerDebugMode` e impostane il valore su `1`.

4. Riapri Illustrator e avvia il pannello da **Finestra > Estensioni > OpenScript Panel**.

### 🍏 macOS

#### Installazione Manuale & Configurazione

1. Scarica e scompatta l'archivio `.zip` della release.

2. Apri il **Finder**, premi la combinazione di tasti `Cmd + Shift + G` e incolla il seguente percorso:

   ```
   ~/Library/Application Support/Adobe/CEP/extensions/
   
   ```

3. Copia all'interno la cartella scompattata dell'estensione (`com.custom.openscriptpanel`).

4. **Abilita la modalità sviluppatore CEP:**

   * Apri il **Terminale** di macOS e incolla questo comando:

     ```
     defaults write com.adobe.CSXS.11 PlayerDebugMode 1
     
     ```

5. **⚠️ IMPORTANTE — Modifica del percorso cartella nel codice:**
   Poiché macOS utilizza la sintassi dei percorsi Unix (`/Users/...`), devi aggiornare il percorso predefinito degli script nel codice prima di usare il pannello:

   * Apri la cartella dell'estensione e vai in `client/main.js`.

   * Cerca la riga di codice in cui è specificata la variabile del percorso predefinito per la cartella degli script.

   * Sostituisci il percorso nel formato Windows (es. `C:\\Users\\...`) con il percorso relativo al tuo Mac (es. `/Users/nomeutente/Documents/Scripts`).

   * Salva il file.

6. Apri Adobe Illustrator e avvia il pannello da **Finestra > Estensioni > OpenScript Panel**.

---

## 📄 Licenza

Distribuito sotto licenza [MIT](LICENSE).
