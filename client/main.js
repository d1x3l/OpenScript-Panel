const csInterface = new CSInterface();
let fs, path, exec;
let nodeEnabled = false;

try {
    fs = require('fs');
    path = require('path');
    exec = require('child_process').exec;
    nodeEnabled = true;
} catch(e) {
    console.warn("Node.js non disponibile.");
}

// Percorso della cartella degli script di Illustrator
const scriptsFolder = "C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/it_IT/Script";

let allPhysicalScripts = [];
let virtualFolders = JSON.parse(localStorage.getItem('scriptPanelVirtualFolders')) || []; 
let favorites = JSON.parse(localStorage.getItem('scriptPanelFavs')) || [];
let virtualNames = JSON.parse(localStorage.getItem('scriptPanelVirtualNames')) || {};
let scriptTags = JSON.parse(localStorage.getItem('scriptPanelTags')) || {};
let hiddenScripts = JSON.parse(localStorage.getItem('scriptPanelHidden')) || [];
let scriptHistory = JSON.parse(localStorage.getItem('scriptPanelHistory')) || []; 
let allCustomTags = JSON.parse(localStorage.getItem('scriptPanelAllTags') || '[]');

let currentTab = 'Tutti';
let currentSelectedTag = 'Tutti';
let activeContextMenu = null;
let selectedItems = { scripts: new Set(), folders: new Set() };

document.addEventListener('DOMContentLoaded', () => {
    if (!nodeEnabled) {
        document.getElementById('scriptList').innerHTML = `<div style="padding:20px; color:#f66; text-align:center;">Errore: Node.js disabilitato.</div>`;
        return;
    }
    
    injectCSS(); 
    setupFileUploader(); 
    loadPhysicalScripts();
    setupSearch();
    setupTabs();
    setupFooterButtons();
    setupRootDropZone();
    setupMarqueeSelection();

    document.addEventListener('click', (e) => {
        if (wasMarqueeDragged) return;

        const isInteractive = e.target.closest('.list-item, .custom-context-menu, .modal-overlay, button, input, select, .tabs-container, .tabs');
        if (!isInteractive) {
            clearSelection();
        }
    });
});

function loadPhysicalScripts() {
    allPhysicalScripts = [];
    try {
        if (fs.existsSync(scriptsFolder)) {
            const items = fs.readdirSync(scriptsFolder);
            items.forEach(file => {
                if (file.toLowerCase().match(/\.(jsx|js)$/)) {
                    allPhysicalScripts.push({ name: file, path: `${scriptsFolder}/${file}` });
                }
            });
            updateTagsDropdown();
            applyFilters();
        }
    } catch (e) { console.error(e); }
}

window.toggleSelection = function(type, id) {
    const targetSet = type === 'script' ? selectedItems.scripts : selectedItems.folders;
    if (targetSet.has(id)) targetSet.delete(id);
    else targetSet.add(id);
    applyFilters();
}

function applyFilters() {
    const searchInput = document.querySelector('.search-box input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const container = document.getElementById('scriptList');
    container.innerHTML = '';

    // Determina se c'è un qualsiasi filtro attivo (ricerca testo o filtro tag)
    const isFiltering = (searchTerm !== '' || currentSelectedTag !== 'Tutti');

    // 1. SCHEDA PREFERITI
    if (currentTab === 'Preferiti') {
        let favScripts = allPhysicalScripts.filter(sc => favorites.includes(sc.name));

        if (hiddenScripts.length > 0) {
            favScripts = favScripts.filter(sc => !hiddenScripts.includes(sc.name));
        }
        if (currentSelectedTag !== 'Tutti') {
            favScripts = favScripts.filter(sc => scriptTags[sc.name] === currentSelectedTag);
        }
        if (searchTerm) {
            favScripts = favScripts.filter(sc => {
                const displayName = virtualNames[sc.name] || sc.name;
                return displayName.toLowerCase().includes(searchTerm);
            });
        }

        if (favScripts.length === 0) {
            let msg = "Nessun preferito salvato.";
            if (currentSelectedTag !== 'Tutti') msg = `Nessun preferito con il tag "${currentSelectedTag}".`;
            else if (searchTerm) msg = "Nessun preferito corrisponde alla ricerca.";
            
            container.innerHTML = `<div style="padding:30px 10px; color:#777; text-align:center; font-size:12px;">${msg}</div>`;
            return;
        }

        favScripts.forEach(scriptObj => {
            container.appendChild(createScriptElement(scriptObj));
        });
        return;
    }

    if (currentTab === 'Cronologia') {
        let count = 0;
        scriptHistory.forEach(histName => {
            const scriptObj = allPhysicalScripts.find(s => s.name === histName);
            if (scriptObj && shouldShow(scriptObj, searchTerm)) {
                container.appendChild(createScriptElement(scriptObj));
                count++;
            }
        });
        if (count === 0) container.innerHTML = '<div style="padding:30px 10px; color:#777; text-align:center; font-size:12px;">Nessuno script recente.</div>';
        return; 
    }

    let totalVisibleItems = 0;
    let scriptsAssignedToFolders = new Set();
    
    virtualFolders.forEach(folder => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'virtual-folder';
        const isSelected = selectedItems.folders.has(folder.id) ? ' selected' : '';
        const folderHeader = document.createElement('div');
        folderHeader.className = 'list-item folder' + isSelected;
        folderHeader.setAttribute('ondragover', 'allowDrop(event)');
        folderHeader.setAttribute('ondrop', `dropOnFolder(event, '${folder.id}')`);
        folderHeader.dataset.type = 'folder';
        folderHeader.dataset.id = folder.id;
        
        folderHeader.innerHTML = `
            <div class="left-content" style="cursor:pointer;" onclick="toggleFolder(this.closest('.folder'))">
                <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" style="fill:#999; flex-shrink:0; transition: transform 0.15s ease;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                <svg width="18" height="18" viewBox="0 0 24 24" style="fill:#999; flex-shrink:0;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                <span class="name" onclick="event.stopPropagation(); toggleSelection('folder', '${folder.id}')">${folder.name}</span>
            </div>
            <div class="right-actions">
                <svg width="18" height="18" onclick="showFolderContextMenu(event, '${folder.id}')" viewBox="0 0 24 24" style="fill:#999; cursor:pointer; flex-shrink:0;"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </div>
        `;
        
        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content'; 
        let visibleCount = 0;
        
        folder.scripts.forEach(scriptName => {
            const scriptObj = allPhysicalScripts.find(s => s.name === scriptName);
            if (scriptObj) {
                scriptsAssignedToFolders.add(scriptName);
                if (shouldShow(scriptObj, searchTerm)) {
                    folderContent.appendChild(createScriptElement(scriptObj));
                    visibleCount++;
                }
            }
        });
        
        folderHeader.querySelector('.left-content').innerHTML += `<span class="count" style="margin-left: 10px; font-size: 10px; color: #888;">${visibleCount}</span>`;
        folderHeader.setAttribute('ondragover', 'allowDrop(event)');
        folderHeader.setAttribute('ondrop', `dropOnFolder(event, '${folder.id}')`);
        // Aggiungi questa riga per il tasto destro sulle cartelle:
        folderHeader.setAttribute('oncontextmenu', `showFolderContextMenu(event, '${folder.id}')`);
        folderDiv.appendChild(folderHeader);
        folderDiv.appendChild(folderContent);

        // Auto-espansione cartella se un qualsiasi filtro (ricerca o tag) produce risultati dentro la cartella
        if (isFiltering && visibleCount > 0) {
            folderContent.classList.add('open');
            const chev = folderHeader.querySelector('.chevron');
            if (chev) chev.style.transform = 'rotate(90deg)';
        }

        // Mostra la cartella solo se contiene script che rispettano il filtro oppure se nessun filtro è attivo
        if (visibleCount > 0 || !isFiltering) {
            container.appendChild(folderDiv);
            totalVisibleItems += visibleCount;
        }
    });

    // Renderizza script fuori dalle cartelle
    allPhysicalScripts.forEach(scriptObj => {
        if (!scriptsAssignedToFolders.has(scriptObj.name)) {
            if (shouldShow(scriptObj, searchTerm)) {
                container.appendChild(createScriptElement(scriptObj));
                totalVisibleItems++;
            }
        }
    });

    // Se nessun elemento soddisfa il filtro attivo, mostra il messaggio dinamico
    if (totalVisibleItems === 0) {
        let msg = "Nessuno script trovato.";
        if (currentSelectedTag !== 'Tutti' && !searchTerm) {
            msg = `Nessuno script con il tag "${currentSelectedTag}".`;
        } else if (searchTerm) {
            msg = "Nessun risultato per la ricerca.";
        }
        container.innerHTML = `<div style="padding:30px 10px; color:#777; text-align:center; font-size:12px;">${msg}</div>`;
    }
}

function shouldShow(scriptObj, searchTerm) {
    if (hiddenScripts.includes(scriptObj.name)) return false; 
    if (currentTab === 'Preferiti' && !favorites.includes(scriptObj.name)) return false;
    if (currentSelectedTag !== 'Tutti') {
        if (scriptTags[scriptObj.name] !== currentSelectedTag) return false;
    }
    const displayName = virtualNames[scriptObj.name] || scriptObj.name;
    if (searchTerm && !displayName.toLowerCase().includes(searchTerm)) return false;
    return true;
}

let wasMarqueeDragged = false; // Flag per evitare che il click finale deselezioni gli elementi

function setupMarqueeSelection() {
    let isDragging = false;
    let startX = 0, startY = 0;
    
    let selectionBox = document.getElementById('selection-box');
    if (!selectionBox) {
        selectionBox = document.createElement('div');
        selectionBox.id = 'selection-box';
        document.body.appendChild(selectionBox);
    }

    const container = document.getElementById('scriptList');
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.play-btn, .play-wrapper, .right-actions, button, input, select, .custom-context-menu, .modal-overlay, .list-item')) {
            return;
        }

        isDragging = true;
        wasMarqueeDragged = false;
        startX = e.pageX;
        startY = e.pageY;

        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';

        if (!e.ctrlKey && !e.shiftKey) {
            selectedItems.scripts.clear();
            selectedItems.folders.clear();
            document.querySelectorAll('.list-item.selected').forEach(el => el.classList.remove('selected'));
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const currentX = e.pageX;
        const currentY = e.pageY;

        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';

        if (width > 3 || height > 3) {
            wasMarqueeDragged = true; // Segnala che stiamo effettivamente trascinando
            selectionBox.style.display = 'block';

            const boxRect = selectionBox.getBoundingClientRect();

            document.querySelectorAll('.list-item').forEach(item => {
                const itemRect = item.getBoundingClientRect();
                
                const isOverlapping = !(
                    itemRect.right < boxRect.left ||
                    itemRect.left > boxRect.right ||
                    itemRect.bottom < boxRect.top ||
                    itemRect.top > boxRect.bottom
                );

                const type = item.dataset.type;
                const id = item.dataset.id;
                if (!type || !id) return;

                const targetSet = type === 'script' ? selectedItems.scripts : selectedItems.folders;

                if (isOverlapping) {
                    targetSet.add(id);
                    item.classList.add('selected');
                } else if (!e.ctrlKey && !e.shiftKey) {
                    targetSet.delete(id);
                    item.classList.remove('selected');
                }
            });
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            selectionBox.style.display = 'none';
            
            // Mantiene la flag attiva un istante per bloccare l'evento di click subito successivo
            setTimeout(() => { wasMarqueeDragged = false; }, 100);
        }
    });
}

function createScriptElement(scriptObj) {
    const isFav = favorites.includes(scriptObj.name);
    const displayName = virtualNames[scriptObj.name] || scriptObj.name;
    const isSelected = selectedItems.scripts.has(scriptObj.name) ? ' selected' : '';
    const item = document.createElement('div');
    // Identificatori per la selezione a trascinamento
    item.dataset.type = 'script';
    item.dataset.id = scriptObj.name;
    item.className = 'list-item script' + isSelected;
    item.draggable = true;
    item.setAttribute('ondragstart', `dragStart(event, '${scriptObj.name}')`);
    const safePath = scriptObj.path.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

    // Tasto destro sull'elemento script
    item.addEventListener('contextmenu', (e) => {
        showContextMenu(e, 'script', scriptObj.name, safePath);
    });

    const playBtnHTML = `
        <div class="play-wrapper" data-tooltip="Esegui: ${displayName}">
            <svg class="play-btn" width="18" height="18" onclick="runScript('${safePath}', '${scriptObj.name}')" viewBox="0 0 24 24" style="fill:#38bdf8; cursor:pointer; flex-shrink:0;">
                <path d="M8 5v14l11-7z"/>
            </svg>
        </div>
    `;
    
    const starIcon = isFav 
        ? `<svg width="18" height="18" onclick="toggleFavorite('${scriptObj.name}')" viewBox="0 0 24 24" style="fill:#d4a34b; cursor:pointer; flex-shrink:0;"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`
        : `<svg width="18" height="18" onclick="toggleFavorite('${scriptObj.name}')" viewBox="0 0 24 24" style="fill:#999; cursor:pointer; flex-shrink:0;"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>`;
        
    const menuIcon = `<svg width="18" height="18" onclick="showContextMenu(event, 'script', '${scriptObj.name}', '${safePath}')" viewBox="0 0 24 24" style="fill:#999; cursor:pointer; flex-shrink:0;"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;

    item.innerHTML = `
        <div class="left-content" style="cursor: grab; flex:1;">
            ${playBtnHTML}
            <span class="name">${displayName}</span>
        </div>
        <div class="right-actions" style="position: relative;">
            ${starIcon}
            ${menuIcon}
        </div>
    `;
    item.querySelector('.left-content').addEventListener('click', (e) => {
        if(e.target.closest('.play-btn') || e.target.closest('.play-wrapper')) return;
        toggleSelection('script', scriptObj.name);
    });
    return item;
}

window.runScript = function(scriptPath, scriptName) { 
    scriptHistory = scriptHistory.filter(s => s !== scriptName); 
    scriptHistory.unshift(scriptName); 
    if(scriptHistory.length > 30) scriptHistory.pop(); 
    localStorage.setItem('scriptPanelHistory', JSON.stringify(scriptHistory));
    csInterface.evalScript(`eseguiScriptDaPercorso("${scriptPath}")`); 
    if (currentTab === 'Cronologia') applyFilters(); 
}

window.clearSelection = function() {
    if (selectedItems.scripts.size > 0 || selectedItems.folders.size > 0) {
        selectedItems.scripts.clear();
        selectedItems.folders.clear();
        applyFilters();
    }
}

window.showContextMenu = function(e, type, id, pathOrNull) {
    e.stopPropagation();
    closeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    menu.style.left = (e.pageX - 140) + 'px';
    menu.style.top = e.pageY + 'px';
    if (type === 'script') {
        menu.innerHTML = `
            <div onclick="actionRename('${id}')">Rinomina script</div>
            <div onclick="openTagModal('${id}')">Modifica tag</div>
            <div onclick="showInExplorer('${pathOrNull}')">Mostra nella cartella</div>
            <div class="danger" onclick="openDeleteModal([{name: '${id}', path: '${pathOrNull}'}], [])">Rimuovi</div>
        `;
    } else {
        menu.innerHTML = `
            <div onclick="renameVirtualFolder('${id}')">Rinomina cartella</div>
            <div class="danger" onclick="openDeleteModal([], ['${id}'])">Elimina</div>
        `;
    }
    document.body.appendChild(menu);
    activeContextMenu = menu;
}
window.showFolderContextMenu = function(e, folderId) { showContextMenu(e, 'folder', folderId, null); }
document.addEventListener('click', closeContextMenu);
function closeContextMenu() { if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; } }

window.showInExplorer = function(filePath) {
    closeContextMenu();
    const winPath = filePath.replace(/\\/g, '\\\\').replace(/\//g, '\\');
    exec(`explorer /select,"${winPath}"`);
}

function openModal(htmlContent) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal';
    overlay.innerHTML = `<div class="modal-box">${htmlContent}</div>`;
    document.body.appendChild(overlay);
}
window.closeModal = function() {
    const overlay = document.getElementById('active-modal');
    if (overlay) overlay.remove();
}

window.openExternalLink = function(url) {
    try {
        const csInterface = new CSInterface();
        csInterface.openURLInDefaultBrowser(url);
    } catch(e) {
        window.open(url, '_blank');
    }
}

window.openExtensionFolder = function() {
    closeModal();
    try {
        const extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        const winPath = extPath.replace(/\\/g, '\\\\').replace(/\//g, '\\');
        exec(`explorer "${winPath}"`);
    } catch(e) {
        exec(`explorer "${__dirname.replace(/\\/g, '\\\\')}"`);
    }
}

window.showContextMenu = function(e, type, id, pathOrNull) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';

    // Calcola la posizione per non far uscire il menu dal pannello
    let leftPos = e.pageX;
    if (leftPos + 160 > window.innerWidth) {
        leftPos = Math.max(10, window.innerWidth - 170);
    }

    menu.style.left = leftPos + 'px';
    menu.style.top = e.pageY + 'px';

    if (type === 'script') {
        menu.innerHTML = `
            <div onclick="actionRename('${id}')">Rinomina script</div>
            <div onclick="openTagModal('${id}')">Modifica tag</div>
            <div onclick="showInExplorer('${pathOrNull}')">Mostra nella cartella</div>
            <div class="danger" onclick="openDeleteModal([{name: '${id}', path: '${pathOrNull}'}], [])">Rimuovi</div>
        `;
    } else {
        menu.innerHTML = `
            <div onclick="renameVirtualFolder('${id}')">Rinomina cartella</div>
            <div class="danger" onclick="openDeleteModal([], ['${id}'])">Elimina</div>
        `;
    }

    document.body.appendChild(menu);
    activeContextMenu = menu;
}

//INFO PANNELLLO
window.openInfoModal = function() {
    openModal(`
        <h3 class="modal-title">OpenScript Panel</h3>
        <p class="modal-text">Versione <b>0.1.0 (Beta)</b></p>
        <p class="modal-text" style="margin-bottom: 20px;">Un pannello moderno, gratuito e open-source per gestire gli script di Adobe Illustrator.</p>
        
        <div class="info-grid-buttons">
            <button onclick="openExtensionFolder()">Apri cartella estensione</button>
            <button onclick="openExternalLink('https://github.com/d1x3l/OpenScript-Panel')">GitHub Repository</button>
            <button onclick="openExternalLink('https://github.com/d1x3l/OpenScript-Panel/issues')">Segnala un problema</button>
            <button onclick="openExternalLink('https://github.com/d1x3l/OpenScript-Panel/releases/latest')">Cerca aggiornamenti</button>
        </div>
        
        <div style="margin-top: 10px;">
            <button class="primary" style="width: 100%; padding: 8px;" onclick="closeModal()">OK</button>
        </div>
    `);
}

window.actionRename = function(scriptName) {
    closeContextMenu();
    const hasCustomName = virtualNames.hasOwnProperty(scriptName);
    const currentName = hasCustomName ? virtualNames[scriptName] : scriptName;
    const restoreBtn = hasCustomName ? `<button onclick="restoreOriginalName('${scriptName}')" style="margin-right: auto;">Ripristina</button>` : '';

    openModal(`
        <h3 class="modal-title">Rinomina script</h3>
        <p class="modal-label">Nuovo nome <span style="color:#777;">(Originale: ${scriptName})</span>:</p>
        <textarea id="renameInput" class="modal-textarea">${currentName}</textarea>
        <div class="modal-buttons">
            ${restoreBtn}
            <button onclick="closeModal()">Annulla</button>
            <button class="primary" onclick="saveRename('${scriptName}')">Salva</button>
        </div>
    `);
    setTimeout(() => { document.getElementById('renameInput').focus(); }, 10);
}

window.saveRename = function(scriptName) {
    const newName = document.getElementById('renameInput').value;
    if (newName !== null) {
        const trimmed = newName.trim();
        if (trimmed === "" || trimmed === scriptName) delete virtualNames[scriptName];
        else virtualNames[scriptName] = trimmed;
        localStorage.setItem('scriptPanelVirtualNames', JSON.stringify(virtualNames));
        applyFilters();
    }
    closeModal();
}

window.restoreOriginalName = function(scriptName) {
    delete virtualNames[scriptName];
    localStorage.setItem('scriptPanelVirtualNames', JSON.stringify(virtualNames));
    applyFilters(); closeModal();
}

window.openDeleteModal = function(scripts, folders) {
    closeContextMenu();
    const hasScripts = scripts.length > 0;
    let title = "Rimuovi";
    let msg = `Rimuovere ${scripts.length} script e ${folders.length} cartelle? I file rimarranno sul disco.`;
    if (scripts.length === 1 && folders.length === 0) msg = `Rimuovere l'elemento selezionato da questa vista? I file rimangono sul disco.`;
    if (scripts.length === 0 && folders.length === 1) msg = `Rimuovere la cartella virtuale? Gli script torneranno nella lista principale.`;

    let actionButtons = `<button class="primary" onclick="executeDelete('panel', '${escape(JSON.stringify(scripts))}', '${escape(JSON.stringify(folders))}')">Rimuovi</button>`;
    if (hasScripts && scripts.length > 0) {
        actionButtons = `
            <button class="primary" onclick="executeDelete('panel', '${escape(JSON.stringify(scripts))}', '${escape(JSON.stringify(folders))}')">Da pannello</button>
            <button class="danger" onclick="executeDelete('disk', '${escape(JSON.stringify(scripts))}', '${escape(JSON.stringify(folders))}')">Da PC</button>
        `;
    }

    openModal(`
        <h3 class="modal-title">${title}</h3>
        <p class="modal-text">${msg}</p>
        <div class="modal-buttons">
            <button onclick="closeModal()">Annulla</button>
            ${actionButtons}
        </div>
    `);
}

window.executeDelete = function(mode, scriptsJson, foldersJson) {
    const scripts = JSON.parse(unescape(scriptsJson));
    const folders = JSON.parse(unescape(foldersJson));
    folders.forEach(id => { virtualFolders = virtualFolders.filter(f => f.id !== id); });
    localStorage.setItem('scriptPanelVirtualFolders', JSON.stringify(virtualFolders));
    
    if (mode === 'panel') {
        scripts.forEach(s => hiddenScripts.push(s.name));
        localStorage.setItem('scriptPanelHidden', JSON.stringify(hiddenScripts));
        selectedItems.scripts.clear(); 
        selectedItems.folders.clear();
        closeModal(); 
        loadPhysicalScripts();
    } else if (mode === 'disk') {
        let errors = [];
        scripts.forEach(s => { 
            try { 
                fs.unlinkSync(s.path); 
            } catch (err) { 
                errors.push(s.name); 
            } 
        });
        
        if (errors.length > 0) {
            let targetPath = scripts.find(s => s.name === errors[0])?.path || scriptsFolder;
            
            openModal(`
                <h3 class="modal-title">Impossibile eliminare il file</h3>
                <p class="modal-text">Il file <b>${errors.join(', ')}</b> potrebbe essere protetto da Windows o attualmente in uso da Illustrator.</p>
                <p class="modal-text">Puoi aprire la cartella degli script ed eliminarlo manualmente.</p>
                <div class="modal-buttons">
                    <button onclick="closeModal()">Chiudi</button>
                    <button class="primary" onclick="openPhysicalFolder('${targetPath.replace(/'/g, "\\'")}')">Apri cartella</button>
                </div>
            `);
        } else {
            selectedItems.scripts.clear(); 
            selectedItems.folders.clear();
            closeModal(); 
            loadPhysicalScripts();
        }
    }
}

// PUNTO 2: Spaziatura e stile per rinomina/creazione cartelle
window.renameVirtualFolder = function(folderId) {
    closeContextMenu();
    const folder = virtualFolders.find(f => f.id === folderId);
    if (!folder) return;
    
    openModal(`
        <h3 class="modal-title">Rinomina cartella</h3>
        <p class="modal-label">Nuovo nome:</p>
        <input type="text" id="renameFolderInput" class="modal-input" value="${folder.name}" style="margin-bottom: 15px;">
        <div class="modal-buttons">
            <button onclick="closeModal()">Annulla</button>
            <button class="primary" onclick="saveFolderRename('${folderId}')">Salva</button>
        </div>
    `);

    setTimeout(() => { document.getElementById('renameFolderInput').focus(); }, 10);
}

window.saveFolderRename = function(folderId) {
    const newName = document.getElementById('renameFolderInput').value;
    const folder = virtualFolders.find(f => f.id === folderId);
    if (newName && newName.trim() !== "") {
        folder.name = newName.trim();
        localStorage.setItem('scriptPanelVirtualFolders', JSON.stringify(virtualFolders));
        applyFilters();
    }
    closeModal();
}

window.openNewFolderModal = function() {
    openModal(`
        <h3 class="modal-title">Nuova cartella</h3>
        <p class="modal-label">Nome cartella:</p>
        <input type="text" id="newFolderInput" class="modal-input" placeholder="Es. Utility, Export, Vettori..." style="margin-bottom: 15px;">
        <div class="modal-buttons">
            <button onclick="closeModal()">Annulla</button>
            <button class="primary" onclick="saveNewFolder()">Crea</button>
        </div>
    `);
    setTimeout(() => { document.getElementById('newFolderInput').focus(); }, 10);
}

window.saveNewFolder = function() {
    const folderName = document.getElementById('newFolderInput').value;
    if (folderName && folderName.trim() !== "") {
        virtualFolders.push({ id: Date.now().toString(), name: folderName.trim(), scripts: [] });
        localStorage.setItem('scriptPanelVirtualFolders', JSON.stringify(virtualFolders));
        applyFilters();
    }
    closeModal();
}

// Gestione Tag
window.openTagModal = function(scriptName) {
    closeContextMenu();
    const currentTag = scriptTags[scriptName] || "";
    
    let activeTags = Object.values(scriptTags);
    let combinedTags = [...new Set([...allCustomTags, ...activeTags])].filter(t => t);
    allCustomTags = combinedTags;
    localStorage.setItem('scriptPanelAllTags', JSON.stringify(allCustomTags));

    let selectOptions = `<option value="">-- Nessun Tag --</option>`;
    combinedTags.forEach(t => { selectOptions += `<option value="${t}" ${t===currentTag?'selected':''}>${t}</option>`; });
    
    let tagsListHTML = combinedTags.length > 0 ? combinedTags.map(tag => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 6px; border-bottom:1px solid #333;">
            <span style="font-size:12px; color:#ccc;">${tag}</span>
            <div style="display:flex; gap:10px; align-items:center;">
                <svg width="15" height="15" viewBox="0 0 24 24" style="fill:#aaa; cursor:pointer;" onclick="promptRenameTag('${tag}', '${scriptName}')" title="Rinomina tag"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                <svg width="15" height="15" viewBox="0 0 24 24" style="fill:#ff6666; cursor:pointer;" onclick="promptDeleteTag('${tag}', '${scriptName}')" title="Elimina tag"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </div>
        </div>
    `).join('') : '<div style="font-size:11px; color:#777; padding:8px;">Nessun tag creato finora.</div>';

    openModal(`
        <h3 class="modal-title">Gestisci Tag</h3>
        <p class="modal-label">Applica tag allo script: <span style="color:#fff;">${scriptName}</span></p>
        
        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
            <select id="tagModalSelect" class="modal-input" style="flex: 1; margin-bottom: 0;">
                ${selectOptions}
            </select>
            <button class="tool-btn" onclick="toggleNewTagInput()" title="Crea nuovo tag" style="background: #3f3f3f; border: 1px solid #555; border-radius: 4px; padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 24 24" style="fill: #ccc; width: 16px; height: 16px;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>
        </div>

        <input type="text" id="tagModalInput" class="modal-input" placeholder="Nome del nuovo tag..." style="display:none; margin-bottom:15px;">
        
        <div class="modal-buttons" style="margin-bottom:20px;">
            <button onclick="closeModal()">Annulla</button>
            <button class="primary" onclick="applyTagToScript('${scriptName}')">Applica al file</button>
        </div>
        <div class="modal-label" style="border-top:1px solid #444; padding-top:15px; margin-bottom:10px;">Gestisci tag esistenti:</div>
        <div style="max-height: 110px; overflow-y:auto; background:#1e1e1e; border:1px solid #555; border-radius:4px; padding:2px;">
            ${tagsListHTML}
        </div>
    `);
}

window.toggleNewTagInput = function() {
    const input = document.getElementById('tagModalInput');
    if (input.style.display === 'none') {
        input.style.display = 'block';
        input.focus();
    } else {
        input.style.display = 'none';
    }
}

window.applyTagToScript = function(scriptName) {
    const sel = document.getElementById('tagModalSelect').value;
    const input = document.getElementById('tagModalInput');
    let newTag = (input.style.display !== 'none' && input.value.trim() !== "") ? input.value.trim() : null;
    
    let tagToApply = newTag ? newTag : sel;
    
    if (newTag && !allCustomTags.includes(newTag)) {
        allCustomTags.push(newTag);
        localStorage.setItem('scriptPanelAllTags', JSON.stringify(allCustomTags));
    }
    
    if (tagToApply === "") delete scriptTags[scriptName];
    else scriptTags[scriptName] = tagToApply;
    
    localStorage.setItem('scriptPanelTags', JSON.stringify(scriptTags));
    updateTagsDropdown(); applyFilters(); closeModal();
}

window.promptRenameTag = function(oldTag, contextScriptName) {
    openModal(`
        <h3 class="modal-title">Rinomina tag</h3>
        <p class="modal-label">Nuovo nome per il tag '${oldTag}':</p>
        <input type="text" id="renameTagInput" class="modal-input" value="${oldTag}">
        <div class="modal-buttons" style="margin-top: 15px;">
            <button onclick="openTagModal('${contextScriptName}')">Annulla</button>
            <button class="primary" onclick="executeRenameTag('${oldTag}', '${contextScriptName}')">Salva</button>
        </div>
    `);
    setTimeout(() => { 
        const input = document.getElementById('renameTagInput');
        input.focus();
        input.select();
    }, 10);
}

window.executeRenameTag = function(oldTag, contextScriptName) {
    const newName = document.getElementById('renameTagInput').value;
    if (newName && newName.trim() !== "" && newName.trim() !== oldTag) {
        const trimmed = newName.trim();
        Object.keys(scriptTags).forEach(k => { if (scriptTags[k] === oldTag) scriptTags[k] = trimmed; });
        allCustomTags = allCustomTags.map(t => t === oldTag ? trimmed : t);
        localStorage.setItem('scriptPanelAllTags', JSON.stringify(allCustomTags));
        localStorage.setItem('scriptPanelTags', JSON.stringify(scriptTags));
        updateTagsDropdown(); applyFilters();
    }
    openTagModal(contextScriptName);
}

window.promptDeleteTag = function(tag, contextScriptName) {
    openModal(`
        <h3 class="modal-title">Elimina tag</h3>
        <p class="modal-text">Sei sicuro di voler eliminare il tag <b>'${tag}'</b> da TUTTI gli script a cui è assigned?</p>
        <div class="modal-buttons">
            <button onclick="openTagModal('${contextScriptName}')">Annulla</button>
            <button class="primary" style="background:#d74040; border-color:#d74040; color:white;" onclick="executeDeleteTag('${tag}', '${contextScriptName}')">Elimina</button>
        </div>
    `);
}

window.executeDeleteTag = function(tag, contextScriptName) {
    Object.keys(scriptTags).forEach(k => { if (scriptTags[k] === tag) delete scriptTags[k]; });
    allCustomTags = allCustomTags.filter(t => t !== tag);
    localStorage.setItem('scriptPanelAllTags', JSON.stringify(allCustomTags));
    localStorage.setItem('scriptPanelTags', JSON.stringify(scriptTags));
    updateTagsDropdown(); applyFilters(); 
    openTagModal(contextScriptName);
}

// PUNTO 1: Pop-up coordinato se non ci sono script nascosti
window.openHiddenScriptsModal = function() {
    if (!hiddenScripts || hiddenScripts.length === 0) {
        openModal(`
            <h3 class="modal-title">Script nascosti</h3>
            <p class="modal-text">Non ci sono script nascosti al momento.</p>
            <div class="modal-buttons">
                <button class="primary" onclick="closeModal()">OK</button>
            </div>
        `);
        return;
    }

    let listHTML = hiddenScripts.map(name => `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding:6px 0;">
            <span style="font-size:12px; color:#ccc;">${name}</span>
            <button onclick="restoreHiddenScript('${name}')" style="background:#444; border:none; color:#fff; padding:4px 8px; border-radius:3px; font-size:11px; cursor:pointer;">Ripristina</button>
        </div>
    `).join('');
    
    openModal(`
        <h3 class="modal-title">Script Nascosti</h3>
        <div style="max-height: 200px; overflow-y: auto; margin-bottom:15px;">${listHTML}</div>
        <div class="modal-buttons"><button onclick="closeModal()">Chiudi</button></div>
    `);
}

window.restoreHiddenScript = function(name) {
    hiddenScripts = hiddenScripts.filter(s => s !== name);
    localStorage.setItem('scriptPanelHidden', JSON.stringify(hiddenScripts));
    closeModal();
    if(hiddenScripts.length > 0) openHiddenScriptsModal();
    applyFilters();
}

window.openPhysicalFolder = function(filePath) {
    closeModal();
    if (filePath && typeof filePath === 'string') {
        const winPath = filePath.replace(/\\/g, '\\\\').replace(/\//g, '\\');
        exec(`explorer /select,"${winPath}"`);
    } else {
        exec(`explorer "${scriptsFolder.replace(/\//g, '\\')}"`);
    }
}

function setupFooterButtons() {
    const btnAdd = document.getElementById('btn-add');
    const btnFolder = document.getElementById('btn-folder');
    const btnHidden = document.getElementById('btn-hidden');
    const btnDelete = document.getElementById('btn-delete');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnInfo = document.getElementById('btn-info');

    if(btnAdd) btnAdd.addEventListener('click', () => { document.getElementById('addScriptInput').click(); });
    if(btnFolder) btnFolder.addEventListener('click', () => { openNewFolderModal(); });
    if(btnHidden) btnHidden.addEventListener('click', () => { openHiddenScriptsModal(); });
    if(btnRefresh) btnRefresh.addEventListener('click', () => { location.reload(); });
    if(btnInfo) btnInfo.addEventListener('click', () => { openInfoModal(); });
    
    if(btnDelete) btnDelete.addEventListener('click', () => {
        let selScripts = []; 
        selectedItems.scripts.forEach(name => { let sc = allPhysicalScripts.find(s => s.name === name); if(sc) selScripts.push(sc); });
        let selFolders = Array.from(selectedItems.folders);
        
        if(selScripts.length === 0 && selFolders.length === 0) { 
            openModal(`
                <h3 class="modal-title">Nessun elemento selezionato</h3>
                <p class="modal-text">Seleziona prima uno o più elementi cliccando sul loro nome, poi premi il cestino per rimuoverli.</p>
                <div class="modal-buttons">
                    <button class="primary" onclick="closeModal()">OK</button>
                </div>
            `);
            return; 
        }
        
        openDeleteModal(selScripts, selFolders);
    });
}

function setupFileUploader() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.js,.jsx'; fileInput.style.display = 'none'; fileInput.id = 'addScriptInput';
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                fs.copyFileSync(file.path, path.join(scriptsFolder, file.name)); loadPhysicalScripts(); 
            } catch(err) {
                if(err.code === 'EPERM' || err.code === 'EACCES') {
                    openModal(`
                        <h3 class="modal-title">Accesso Negato</h3>
                        <p class="modal-text">Windows protegge la cartella <b>Program Files</b> e impedisce l'inserimento in automatico.</p>
                        <p class="modal-text">Puoi riavviare Illustrator come <b>Amministratore</b>, oppure aprire la cartella e incollare lo script manualmente.</p>
                        <div class="modal-buttons">
                            <button onclick="closeModal()">Annulla</button>
                            <button class="primary" onclick="openPhysicalFolder()">Apri cartella</button>
                        </div>
                    `);
                } else { alert("Errore sconosciuto durante la copia:\n" + err.message); }
            }
        }
        fileInput.value = ''; 
    });
}

// PUNTO 3: CSS aggiornato e rifinito per modali e schede
function injectCSS() {
    const style = document.createElement('style');
    style.innerHTML = `

        /* Rettangolo di selezione a trascinamento (Marquee) */
        #selection-box {
            position: absolute;
            border: 1px solid #38bdf8;
            background: rgba(56, 189, 248, 0.2);
            pointer-events: none;
            z-index: 1500;
            display: none;
            border-radius: 2px;
        }

        /* Tooltip personalizzato al passaggio del mouse sul pulsante Play */
        .play-wrapper {
            position: relative;
            display: inline-flex;
            align-items: center;
        }
        .play-wrapper::after {
            content: attr(data-tooltip);
            position: absolute;
            top: 100%;
            left: 0;
            margin-top: 5px;
            background: #252525;
            color: #eeeeee;
            border: 1px solid #777777;
            padding: 4px 8px;
            border-radius: 2px;
            font-size: 11px;
            white-space: nowrap;
            z-index: 3000;
            pointer-events: none;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.12s ease, visibility 0.12s ease;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            font-family: sans-serif;
            font-weight: normal;
        }
        .play-wrapper:hover::after {
            opacity: 1;
            visibility: visible;
        }
        .play-btn:hover {
            fill: #7dd3fc !important;
            transform: scale(1.1);
        }

        .custom-context-menu { position: absolute; background: #2d2d2d; border: 1px solid #222; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.6); padding: 5px 0; z-index: 1000; min-width: 160px; color: #eee; font-family: sans-serif; font-size: 12px; }
        .custom-context-menu div { padding: 8px 15px; cursor: pointer; transition: background 0.1s; }
        .custom-context-menu div:hover { background: #3a3a3a; }
        .custom-context-menu div.danger:hover { background: #ff4a4a; color: white; }
        
        .modal-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); display:flex; justify-content:center; align-items:center; z-index: 2000; }
        .modal-box { background: #2b2b2b; padding: 20px 22px; border-radius: 6px; width: 85%; max-width: 320px; color: #ddd; font-family: sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.6); border: 1px solid #1a1a1a; }
        .modal-title { font-size: 14px; font-weight: bold; margin: 0 0 15px 0; color: #fff; }
        .modal-label { font-size: 12px; color: #aaa; margin: 0 0 6px 0; }
        .modal-text { font-size: 13px; color: #ccc; margin: 0 0 20px 0; line-height: 1.4; }
        
        .modal-textarea { width: 100%; background: #1e1e1e; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 4px; resize: vertical; min-height: 70px; box-sizing: border-box; font-family: inherit; font-size: 13px; margin-bottom: 20px; }
        .modal-input { 
            width: 100%; 
            background: #2b2b2b; 
            border: 1px solid #555; 
            color: #eee; 
            padding: 6px 10px; 
            border-radius: 4px; 
            font-size: 13px; 
            outline: none; 
            box-sizing: border-box;
        }
        select.modal-input {
            appearance: none;
            -webkit-appearance: none;
            padding-right: 30px;
            background-image: url("data:image/svg+xml;utf8,<svg fill='%23cccccc' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
            background-repeat: no-repeat;
            background-position: right 8px center;
        }
        .modal-input:focus, .modal-textarea:focus { outline: none; border-color: #777; }
        
        .modal-buttons { display: flex; justify-content: flex-end; gap: 10px; }
        .modal-buttons button { background: #444; border: 1px solid #444; color: #eee; padding: 7px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: 0.1s; }
        .modal-buttons button:hover { background: #555; border-color: #555;}
        .modal-buttons button.primary { 
            background: #e0e0e0; 
            border-color: #e0e0e0; 
            color: #1e1e1e; 
            font-weight: 600;
        }
        .modal-buttons button.primary:hover { 
            background: #ffffff; 
            border-color: #ffffff; 
        }
        .modal-buttons button.danger { background: transparent; border-color:#ff4a4a; color:#ff4a4a;}
        .modal-buttons button.danger:hover { background: #ff4a4a; color: white; }

        .info-grid-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 8px;
        }
        .info-grid-buttons button {
            width: 100%;
            padding: 8px 10px;
            text-align: center;
            background: #383838;
            border: 1px solid #484848;
            color: #ddd;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            transition: background 0.1s;
        }
        .info-grid-buttons button:hover {
            background: #444;
            border-color: #555;
        }

        .folder-content {
            display: none;
            margin-left: 12px;
        }
        .folder-content.open {
            display: block;
        }

        .tabs-container, .tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 4px; 
            padding: 2px;
            background: #323232;
            border-radius: 6px;
            border: 1px solid #383838;
        }
        .tab, .tab-btn {
            flex: 1;
            padding: 6px 10px;
            background: transparent;
            border: none;
            color: #888888;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            text-align: center;
            box-sizing: border-box;
            transition: all 0.15s ease;
        }
        .tab:hover, .tab-btn:hover {
            color: #dddddd;
            background: #2c2c2c;
        }
        .tab.active, .tab-btn.active {
            background: #383838;
            color: #ffffff;
            font-weight: 600;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
    `;
    document.head.appendChild(style);
}

window.dragStart = function(ev, scriptName) { ev.dataTransfer.setData("scriptName", scriptName); }
window.allowDrop = function(ev) { ev.preventDefault(); }
window.dropOnFolder = function(ev, folderId) {
    ev.preventDefault(); ev.stopPropagation();
    const scriptName = ev.dataTransfer.getData("scriptName");
    virtualFolders.forEach(f => { f.scripts = f.scripts.filter(s => s !== scriptName); });
    const folder = virtualFolders.find(f => f.id === folderId);
    if (folder && !folder.scripts.includes(scriptName)) { folder.scripts.push(scriptName); }
    localStorage.setItem('scriptPanelVirtualFolders', JSON.stringify(virtualFolders)); applyFilters();
}
window.dropOnRoot = function(ev) {
    ev.preventDefault(); const scriptName = ev.dataTransfer.getData("scriptName");
    virtualFolders.forEach(f => { f.scripts = f.scripts.filter(s => s !== scriptName); });
    localStorage.setItem('scriptPanelVirtualFolders', JSON.stringify(virtualFolders)); applyFilters();
}
function setupRootDropZone() {
    const listContainer = document.getElementById('scriptList');
    if(listContainer) {
        listContainer.setAttribute('ondragover', 'allowDrop(event)'); 
        listContainer.setAttribute('ondrop', 'dropOnRoot(event)'); 
        listContainer.style.paddingBottom = "100px"; 
    }
}
window.toggleFolder = function(headerEl) {
    const content = headerEl.nextElementSibling; 
    const chev = headerEl.querySelector('.chevron');
    if (content) { 
        content.classList.toggle('open'); 
        chev.style.transform = content.classList.contains('open') ? 'rotate(90deg)' : 'none'; 
    }
}
function updateTagsDropdown() {
    const tagSelect = document.getElementById('tagFilter');
    if (!tagSelect) return;
    
    // Unisce i tag salvati con quelli attualmente in uso sugli script
    let activeTags = Object.values(scriptTags);
    let combinedTags = [...new Set([...allCustomTags, ...activeTags])].filter(t => t);
    
    tagSelect.innerHTML = `<option value="Tutti">Tutti i tag</option>`;
    combinedTags.forEach(tag => { 
        tagSelect.innerHTML += `<option value="${tag}" ${tag === currentSelectedTag ? 'selected' : ''}>${tag}</option>`; 
    });
    
    tagSelect.onchange = (e) => { 
        currentSelectedTag = e.target.value; 
        applyFilters(); 
    };
}
window.toggleFavorite = function(scriptName) {
    if (favorites.includes(scriptName)) favorites = favorites.filter(fav => fav !== scriptName); else favorites.push(scriptName);
    localStorage.setItem('scriptPanelFavs', JSON.stringify(favorites)); applyFilters(); 
}
function setupSearch() {
    const searchInput = document.querySelector('.search-box input'); if (searchInput) searchInput.addEventListener('input', applyFilters);
}
function setupTabs() {
    document.querySelectorAll('.tab, .tab-btn').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab, .tab-btn').forEach(t => t.classList.remove('active')); 
            e.target.classList.add('active');
            currentTab = e.target.innerText.trim(); 
            applyFilters();
        });
    });
}