const ProjectManager = {
    tree: [],
    init() {
    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.apiBase) || '/';
    const projectsUrl = apiBase + 'api/projects';
    fetch(projectsUrl)
            .then(res => {
                if (!res.ok) throw new Error('no server');
                return res.json();
            })
            .then(data => {
                this.tree = data;
                const container = document.getElementById('project-container');
                if (container) this.buildTree(this.tree, container);
            })
            .catch(err => {
        console.warn('ProjectManager: falling back to local directory picker', err);
                const container = document.getElementById('project-container');
                if (container) container.innerHTML = '<div style="padding:12px;color:var(--panel-text);opacity:0.8;">No server project index. Use <button onclick="document.getElementById(\'projectsDirInput\').click()">Load Projects Folder</button> or Upload files. (Using browser storage is available)</div>';
                const dirInput = document.getElementById('projectsDirInput');
                const uploadInput = document.getElementById('projectsUploadInput');
                if (dirInput) dirInput.addEventListener('change', (e) => { this.loadDirectoryFiles(e.target.files); this.tryUploadFiles(e.target.files).catch(()=>{ IDBStorage.saveFiles(e.target.files).then(()=>{ this.loadFromIDB(); }); }); });
                if (uploadInput) uploadInput.addEventListener('change', (e) => { this.addUploadedFiles(e.target.files); this.tryUploadFiles(e.target.files).catch(()=>{ IDBStorage.saveFiles(e.target.files).then(()=>{ this.loadFromIDB(); }); }); });
                // Attempt to load from IndexedDB if present
                this.loadFromIDB().catch(()=>{});
            });
    },

    loadDirectoryFiles(fileList) {
        const files = Array.from(fileList);
        const root = [];

        files.forEach(file => {
            const rel = file.webkitRelativePath || file.name;
            const parts = rel.split('/');
            let cur = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = (i === parts.length - 1);

                if (isFile) {
                    cur.push({ type: 'file', name: part, file: file, path: rel });
                } else {
                    let folder = cur.find(x => x.type === 'folder' && x.name === part);
                    if (!folder) {
                        folder = { type: 'folder', name: part, contents: [] };
                        cur.push(folder);
                    }
                    cur = folder.contents;
                }
            }
        });

        this.tree = root;
        const container = document.getElementById('project-container');
        if (container) this.buildTree(this.tree, container);
    },

    addUploadedFiles(fileList) {
        const files = Array.from(fileList);
        files.forEach(file => {
            this.tree.push({ type: 'file', name: file.name, file: file, path: file.name });
        });
        const container = document.getElementById('project-container');
        if (container) this.buildTree(this.tree, container);
    },

        tryUploadFiles(fileList) {
        // Attempt to upload files to server at /upload preserving relative paths when available.
        const files = Array.from(fileList || []);
        if (files.length === 0) return Promise.reject(new Error('no files'));

        const form = new FormData();
        files.forEach(f => {
            const name = f.webkitRelativePath || f.name;
            form.append('files', f, name);
        });

        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.apiBase) || '/';
        const uploadUrl = apiBase + 'upload';

        return fetch(uploadUrl, { method: 'POST', body: form })
            .then(res => {
                if (!res.ok) throw new Error('upload failed');
                return res.json();
            })
            .then(result => {
                console.log('Uploaded files to server:', result.saved || result);
                const c = document.getElementById('project-container');
                if (c) c.insertAdjacentHTML('afterbegin', '<div style="padding:8px;color:var(--accent);">Uploaded to server</div>');
                return result;
            })
            .catch(err => {
                console.warn('Upload to server failed or not available, saving to browser storage:', err);
                // Fallback: save into IndexedDB so app works on static hosts
                return IDBStorage.saveFiles(files).then(saved => {
                    const c = document.getElementById('project-container');
                    if (c) c.insertAdjacentHTML('afterbegin', '<div style="padding:8px;color:var(--accent);">Saved to browser storage</div>');
                    // rebuild tree from IDB
                    return this.loadFromIDB();
                });
            });
    },

        async loadFromIDB(){
            if(!window.IDBStorage) return Promise.reject(new Error('no idb'));
            const entries = await IDBStorage.listFiles();
            if(!entries || entries.length===0) return Promise.reject(new Error('empty'));
            // Build nested tree from paths
            const root = [];
            entries.forEach(e => {
                const parts = e.path.split('/');
                let cur = root;
                for(let i=0;i<parts.length;i++){
                    const part = parts[i];
                    const isFile = (i===parts.length-1);
                    if(isFile){
                        cur.push({ type:'file', name: part, path: e.path, idb: true });
                    } else {
                        let folder = cur.find(x=>x.type==='folder' && x.name===part);
                        if(!folder){ folder={ type:'folder', name: part, contents: [] }; cur.push(folder); }
                        cur = folder.contents;
                    }
                }
            });
            this.tree = root;
            const container = document.getElementById('project-container');
            if (container) this.buildTree(this.tree, container);
            return root;
        },

    buildTree(data, parentElement) {
        parentElement.innerHTML = '';

        data.forEach(item => {
            const row = document.createElement('div');
            row.className = 'proj-item';

            if (item.type === 'folder') {
                row.innerHTML = `<div style="display:flex;align-items:center;"><span class="material-icons">folder</span> ${item.name}</div><span class="material-icons">expand_more</span>`;

                const nestedContainer = document.createElement('div');
                nestedContainer.className = 'proj-folder';
                this.buildTree(item.contents, nestedContainer);

                row.onclick = () => {
                    nestedContainer.classList.toggle('open');
                    row.querySelector('span:last-child').innerText = nestedContainer.classList.contains('open') ? 'expand_less' : 'expand_more';
                };

                parentElement.appendChild(row);
                parentElement.appendChild(nestedContainer);
            } else if (item.type === 'file') {
                row.innerHTML = `<div style="display:flex;align-items:center;"><span class="material-icons">insert_drive_file</span> ${item.name}</div>`;

                const openBtn = document.createElement('button');
                openBtn.className = 'proj-open-btn';
                openBtn.innerText = 'Open';

                row.onclick = () => {
                    document.querySelectorAll('.proj-open-btn').forEach(btn => btn.style.display = 'none');
                    openBtn.style.display = 'block';
                };

                openBtn.onclick = (e) => {
                    e.stopPropagation();
                    openBtn.innerText = 'Loading...';

                    if (item.file) {
                        this.openLocalFile(item.file);
                        openBtn.innerText = 'Open';
                    } else if (item.idb) {
                        // load from IndexedDB
                        IDBStorage.getFile(item.path).then(blob => {
                            if (!blob) throw new Error('not found in idb');
                            const fileData = new File([blob], item.name, { type: blob.type });
                            this.openLocalFile(fileData);
                            openBtn.innerText = 'Open';
                        }).catch(err => {
                            console.error('Failed to load IDB file:', err);
                            openBtn.innerText = 'Error';
                        });
                    } else if (item.path) {
                        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.apiBase) || '/';
                        const url = (item.path.startsWith('http') || item.path.startsWith('/')) ? item.path : apiBase + item.path;
                        fetch(url)
                            .then(response => response.blob())
                            .then(blob => {
                                const fileData = new File([blob], item.name);
                                this.openLocalFile(fileData);
                                openBtn.innerText = 'Open';
                            })
                            .catch(err => {
                                console.error('Failed to load file:', err);
                                openBtn.innerText = 'Error';
                            });
                    } else {
                        openBtn.innerText = 'Error';
                    }
                };

                row.appendChild(openBtn);
                parentElement.appendChild(row);
            }
        });
    },

    openLocalFile(file) {
        // If the file is a 3DD/.3dcsl, forward it to the app's fileInput so the parser loads it into the 3D scene
        const name = (file && file.name) ? file.name.toLowerCase() : '';
        if (name.endsWith('.3dd') || name.endsWith('.3dcsl')) {
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }

        // Fallback: show in simple viewer for non-3D files
        const viewer = document.getElementById('project-file-viewer');
        const filename = document.getElementById('viewer-filename');
        const content = document.getElementById('viewer-content');
        filename.innerText = file.name;
        content.innerHTML = '';

        const textLike = file.type.startsWith('text') || /\.(txt|md|json|csv|xml|html|css|js|csl)$/i.test(file.name);

        if (textLike) {
            const reader = new FileReader();
            reader.onload = () => { content.textContent = reader.result; viewer.style.display = 'block'; };
            reader.onerror = () => { content.textContent = 'Failed to read file.'; viewer.style.display = 'block'; };
            reader.readAsText(file);
        } else {
            if (/^image\//.test(file.type)) {
                const url = URL.createObjectURL(file);
                const img = document.createElement('img');
                img.src = url; img.style.maxWidth = '100%'; img.style.maxHeight = '100%';
                content.appendChild(img);
                viewer.style.display = 'block';
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(file);
                link.download = file.name;
                link.innerText = 'Download ' + file.name;
                link.style.color = 'var(--accent)';
                content.appendChild(link);
                viewer.style.display = 'block';
            }
        }
    },

    downloadAll() {
        alert('Download All is not supported in local mode. Open files and download individually.');
    }
};

setTimeout(() => ProjectManager.init(), 1000);