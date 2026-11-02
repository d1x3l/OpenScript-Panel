function eseguiScriptDaPercorso(percorsoCompleto) {
    try {
        var scriptFile = new File(percorsoCompleto);
        if (scriptFile.exists) {
            $.evalFile(scriptFile);
        } else {
            alert("File non trovato: " + percorsoCompleto);
        }
    } catch (e) {
        alert("Errore dello script in esecuzione: " + e.message);
    }
}