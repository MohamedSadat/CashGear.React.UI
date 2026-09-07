class CgPdfController {
    constructor(root, viewport, viewerElement, sidebar, dotNet, options, pdfjsRoot, pdfjs, viewerLib) {
        this.root = root;
        this.root.style.setProperty("--cg-pdf-text-selection", options.allowTextSelection === false ? "none" : "text");
        this.viewport = viewport;
        this.viewerElement = viewerElement;
        this.sidebar = sidebar instanceof Element ? sidebar : null;
        this.sidebarContent = this.sidebar?.querySelector("[data-cg-pdf-sidebar-content]") ?? null;
        this.dotNet = dotNet;
        this.options = { ...options };
        this.pdfjsRoot = pdfjsRoot;
        this.pdfjs = pdfjs;
        this.viewerLib = viewerLib;
        this.activeGeneration = 0;
        this.loadingTask = null;
        this.pdfDocument = null;
        this.passwordCallback = null;
        this.passwordCanceled = false;
        this.passwordWasRequested = false;
        this.lastSearchText = "";
        this.lastPageReason = "Scroll";
        this.lastZoomReason = "Command";
        this.lastLoadedBytes = null;
        this.outline = null;
        this.hasForms = false;
        this.objectUrls = new Set();
        this.disposed = false;
        this.resizeTimer = 0;
        this.scrollTimer = 0;
        this.sidebarObserver = null;

        this.abortController = new AbortController();
        this.viewerStylesheet = document.createElement("link");
        this.viewerStylesheet.rel = "stylesheet";
        this.viewerStylesheet.href = new URL("web/pdf_viewer.css", this.pdfjsRoot).href;
        this.viewerStylesheet.dataset.cgPdfViewerStyles = "6.2.108";
        document.head.append(this.viewerStylesheet);

        pdfjs.GlobalWorkerOptions.workerSrc = new URL("build/pdf.worker.mjs", this.pdfjsRoot).href;
        this.eventBus = new viewerLib.EventBus();
        this.linkService = new viewerLib.PDFLinkService({
            eventBus: this.eventBus,
            externalLinkTarget: viewerLib.LinkTarget.NONE,
            externalLinkRel: "noopener noreferrer nofollow",
            ignoreDestinationZoom: false,
        });
        this.linkService.externalLinkEnabled = !!options.allowExternalLinks;
        this.findController = new viewerLib.PDFFindController({
            eventBus: this.eventBus,
            linkService: this.linkService,
            updateMatchesCountOnProgress: true,
        });
        const annotationMode = !options.showAnnotationLayer
            ? pdfjs.AnnotationMode.DISABLE
            : options.allowFormFields
                ? pdfjs.AnnotationMode.ENABLE_FORMS
                : pdfjs.AnnotationMode.ENABLE;
        this.l10n = new viewerLib.GenericL10n(document.documentElement.lang || "en-US");
        this.pdfViewer = new viewerLib.PDFViewer({
            container: viewport,
            viewer: viewerElement,
            eventBus: this.eventBus,
            linkService: this.linkService,
            findController: this.findController,
            l10n: this.l10n,
            // TextLayerMode is internal to the generic viewer bundle in PDF.js
            // 6.x (0 = disabled, 1 = enabled), rather than a core API export.
            textLayerMode: options.showTextLayer ? 1 : 0,
            annotationMode,
            annotationEditorMode: pdfjs.AnnotationEditorType.NONE,
            imageResourcesPath: new URL("web/images/", this.pdfjsRoot).href,
            enablePermissions: true,
            enableAutoLinking: !!options.allowExternalLinks,
            enableSelectionRendering: options.allowTextSelection !== false,
            imagesRightClickMinSize: -1,
            enableHWA: false,
            maxCanvasPixels: 32 * 1024 * 1024,
            maxCanvasDim: 32767,
            capCanvasAreaFactor: 2,
            enableDetailCanvas: true,
            enableOptimizedPartialRendering: true,
        });
        this.linkService.setViewer(this.pdfViewer);
        this.installEvents();
    }

    installEvents() {
        const signal = this.abortController.signal;
        this.eventBus.on("pagechanging", event => {
            if (this.disposed || !this.pdfDocument) return;
            const page = Number(event.pageNumber || this.pdfViewer.currentPageNumber || 1);
            this.updateCurrentThumbnail(page);
            void this.safeDotNet("OnPageChangedAsync", this.activeGeneration, page, this.lastPageReason);
            this.lastPageReason = "Scroll";
        }, { signal });

        this.eventBus.on("scalechanging", event => {
            if (this.disposed || !this.pdfDocument) return;
            const scale = Number(event.scale || this.pdfViewer.currentScale || 1);
            const mode = this.zoomModeFromValue(event.presetValue || this.pdfViewer.currentScaleValue);
            void this.safeDotNet("OnZoomChangedAsync", this.activeGeneration, scale, mode, this.lastZoomReason);
            this.lastZoomReason = "Command";
        }, { signal });

        const updateSearch = event => {
            const matches = event?.matchesCount ?? { current: 0, total: 0 };
            void this.safeDotNet(
                "OnSearchCompletedAsync",
                this.activeGeneration,
                this.lastSearchText,
                Number(matches.current || 0),
                Number(matches.total || 0));
        };
        this.eventBus.on("updatefindmatchescount", updateSearch, { signal });
        this.eventBus.on("updatefindcontrolstate", updateSearch, { signal });

        this.eventBus.on("pagerendered", () => {
            this.decoratePages();
            this.root.dataset.cgPdfRenderedCanvases = String(this.viewerElement.querySelectorAll("canvas").length);
        }, { signal });
        this.eventBus.on("pagesdestroy", () => {
            this.root.dataset.cgPdfRenderedCanvases = "0";
        }, { signal });

        this.root.addEventListener("click", event => void this.interceptLink(event), { capture: true, signal });
        this.root.addEventListener("keydown", event => void this.handleKeyDown(event), { capture: true, signal });
        this.viewport.addEventListener("scroll", () => {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = window.setTimeout(() => {
                this.root.dataset.cgPdfRenderedCanvases = String(this.viewerElement.querySelectorAll("canvas").length);
            }, 180);
        }, { passive: true, signal });

        this.resizeObserver = new ResizeObserver(() => {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = window.setTimeout(() => {
                if (!this.pdfDocument || this.disposed || this.options.zoomMode === "Custom" || this.options.zoomMode === "ActualSize") return;
                const page = this.pdfViewer.currentPageNumber;
                this.lastZoomReason = "Resize";
                this.applyZoomMode(this.options.zoomMode);
                this.pdfViewer.currentPageNumber = page;
            }, 100);
        });
        this.resizeObserver.observe(this.viewport);
    }

    async loadUrl(value, generation, options) {
        let resolved;
        try {
            resolved = new URL(value, document.baseURI);
            if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
                return this.failure("UnsafeUrl", "Only HTTP and HTTPS PDF URLs are supported.");
            }
        } catch {
            return this.failure("UnsafeUrl", "The PDF URL is invalid.");
        }

        if (!await this.beginLoad(generation, options)) return { succeeded: false, canceled: true };
        let limitError = null;
        const task = this.pdfjs.getDocument(this.documentParameters({ url: resolved.href }));
        this.loadingTask = task;
        this.configurePassword(task, generation);
        task.onProgress = progress => {
            const loaded = Number(progress.loaded || 0);
            const total = Number(progress.total || 0) || null;
            this.lastLoadedBytes = loaded || this.lastLoadedBytes;
            if ((total && total > options.maximumBytes) || loaded > options.maximumBytes) {
                limitError = "DocumentTooLarge";
                void task.destroy();
                return;
            }
            void this.safeDotNet("OnLoadProgressAsync", generation, loaded, total);
        };

        try {
            const documentProxy = await task.promise;
            if (generation !== this.activeGeneration || this.disposed) {
                await documentProxy.destroy();
                return { succeeded: false, canceled: true };
            }
            return await this.finishLoad(documentProxy, generation, options, this.lastLoadedBytes);
        } catch (error) {
            if (generation !== this.activeGeneration || this.disposed || this.passwordCanceled) return { succeeded: false, canceled: true };
            return this.mapError(error, limitError);
        }
    }

    async loadStream(streamReference, generation, options) {
        if (!await this.beginLoad(generation, options)) return { succeeded: false, canceled: true };
        let bytes;
        try {
            const buffer = await streamReference.arrayBuffer();
            if (generation !== this.activeGeneration || this.disposed) return { succeeded: false, canceled: true };
            bytes = new Uint8Array(buffer);
        } catch (error) {
            if (generation !== this.activeGeneration || this.disposed) return { succeeded: false, canceled: true };
            return this.mapError(error);
        }
        if (bytes.byteLength === 0) return this.failure("EmptyDocument", "The PDF document is empty.");
        if (bytes.byteLength > options.maximumBytes) return this.failure("DocumentTooLarge", "The PDF document exceeds its configured limit.");
        if (!this.isSupportedMime(options.mimeType)) return this.failure("InvalidMimeType", "The supplied media type is not a PDF.");
        const header = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 1024)));
        if (!header.includes("%PDF-")) return this.failure("InvalidSignature", "The selected data does not contain a PDF header.");
        this.lastLoadedBytes = bytes.byteLength;
        void this.safeDotNet("OnLoadProgressAsync", generation, bytes.byteLength, bytes.byteLength);

        const task = this.pdfjs.getDocument(this.documentParameters({ data: bytes }));
        this.loadingTask = task;
        this.configurePassword(task, generation);
        try {
            const documentProxy = await task.promise;
            if (generation !== this.activeGeneration || this.disposed) {
                await documentProxy.destroy();
                return { succeeded: false, canceled: true };
            }
            return await this.finishLoad(documentProxy, generation, options, bytes.byteLength);
        } catch (error) {
            if (generation !== this.activeGeneration || this.disposed || this.passwordCanceled) return { succeeded: false, canceled: true };
            return this.mapError(error);
        }
    }

    documentParameters(source) {
        return {
            ...source,
            cMapUrl: new URL("cmaps/", this.pdfjsRoot).href,
            cMapPacked: true,
            standardFontDataUrl: new URL("standard_fonts/", this.pdfjsRoot).href,
            iccUrl: new URL("iccs/", this.pdfjsRoot).href,
            wasmUrl: new URL("wasm/", this.pdfjsRoot).href,
            useWasm: false,
            isEvalSupported: false,
            enableXfa: false,
            useSystemFonts: true,
            stopAtErrors: false,
            withCredentials: false,
        };
    }

    configurePassword(task, generation) {
        task.onPassword = (callback, reason) => {
            if (generation !== this.activeGeneration || this.disposed) return;
            this.passwordCallback = callback;
            this.passwordWasRequested = true;
            const label = reason === this.pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "Incorrect" : "Required";
            void this.safeDotNet("OnPasswordRequestedAsync", generation, label);
        };
    }

    async finishLoad(documentProxy, generation, options, sizeBytes) {
        if (documentProxy.numPages > Number(options.maximumPages)) {
            await documentProxy.destroy();
            return this.failure("PageLimitExceeded", "The PDF exceeds its configured page limit.");
        }
        this.pdfDocument = documentProxy;
        this.findController.setDocument(documentProxy);
        this.linkService.setDocument(documentProxy, null);
        this.pdfViewer.setDocument(documentProxy);
        await this.pdfViewer.firstPagePromise;

        this.pdfViewer.scrollMode = options.continuousScroll
            ? this.viewerLib.ScrollMode.VERTICAL
            : this.viewerLib.ScrollMode.PAGE;
        this.pdfViewer.pagesRotation = this.normalizeRotation(options.rotation);
        this.root.dataset.cgPdfRotation = String(this.pdfViewer.pagesRotation);
        this.lastZoomReason = "Load";
        this.options.zoomMode = options.zoomMode || this.options.zoomMode;
        this.applyZoomMode(this.options.zoomMode, options.zoom);
        this.lastPageReason = "Load";
        this.pdfViewer.currentPageNumber = this.clampPage(options.currentPage || 1);

        let metadata = null;
        try { metadata = await documentProxy.getMetadata(); } catch { }
        try { this.outline = await documentProxy.getOutline(); } catch { this.outline = null; }
        try { this.hasForms = !!(await documentProxy.getFieldObjects()); } catch { this.hasForms = false; }
        await this.setSidebarMode(options.sidebarMode || "None");
        this.decoratePages();
        this.root.dataset.cgPdfReady = "true";
        this.root.dataset.cgPdfPageCount = String(documentProxy.numPages);
        return {
            succeeded: true,
            canceled: false,
            documentInfo: this.metadataResult(metadata, documentProxy.numPages, sizeBytes),
        };
    }

    metadataResult(metadata, pageCount, sizeBytes) {
        const info = metadata?.info ?? {};
        const custom = metadata?.metadata;
        const pick = (infoName, metadataName) => info[infoName] ?? custom?.get?.(metadataName) ?? null;
        return {
            pageCount,
            sizeBytes: sizeBytes || null,
            pdfFormatVersion: info.PDFFormatVersion ?? null,
            title: pick("Title", "dc:title"),
            author: pick("Author", "dc:creator"),
            subject: pick("Subject", "dc:description"),
            keywords: info.Keywords ?? null,
            creator: pick("Creator", "xmp:creatortool"),
            producer: info.Producer ?? null,
            language: custom?.get?.("dc:language") ?? null,
            creationDate: info.CreationDate ?? null,
            modifiedDate: info.ModDate ?? null,
            isEncrypted: this.passwordWasRequested,
            hasOutline: Array.isArray(this.outline) && this.outline.length > 0,
            hasForms: this.hasForms,
        };
    }

    async beginLoad(generation, options) {
        const requestedGeneration = Number(generation);
        if (requestedGeneration < this.activeGeneration) return false;
        this.activeGeneration = requestedGeneration;
        this.options = { ...this.options, ...options };
        this.passwordCallback = null;
        this.passwordCanceled = false;
        this.passwordWasRequested = false;
        this.lastLoadedBytes = null;
        this.outline = null;
        this.hasForms = false;
        delete this.root.dataset.cgPdfReady;
        this.root.dataset.cgPdfRenderedCanvases = "0";
        await this.destroyDocument();
        if (requestedGeneration !== this.activeGeneration || this.disposed) return false;
        return true;
    }

    async destroyDocument() {
        this.sidebarObserver?.disconnect();
        this.sidebarObserver = null;
        if (this.sidebarContent) this.sidebarContent.replaceChildren();
        this.findController?.setDocument(null);
        this.linkService?.setDocument(null);
        this.pdfViewer?.setDocument(null);
        const task = this.loadingTask;
        const documentProxy = this.pdfDocument;
        this.loadingTask = null;
        this.pdfDocument = null;
        if (task) {
            try { await task.destroy(); } catch { }
        }
        if (documentProxy) {
            try { await documentProxy.destroy(); } catch { }
        }
    }

    async clear(generation) {
        const accepted = await this.beginLoad(generation, this.options);
        if (accepted) {
            delete this.root.dataset.cgPdfReady;
            delete this.root.dataset.cgPdfPageCount;
        }
        return accepted;
    }

    async goToPage(pageNumber, reason = "Navigation") {
        if (!this.pdfDocument) return false;
        this.lastPageReason = reason;
        this.pdfViewer.currentPageNumber = this.clampPage(pageNumber);
        return true;
    }

    async setZoom(zoom, reason = "Command") {
        if (!this.pdfDocument || !Number.isFinite(Number(zoom))) return false;
        const value = Math.min(Number(this.options.maximumZoom), Math.max(Number(this.options.minimumZoom), Number(zoom)));
        this.options.zoomMode = "Custom";
        this.lastZoomReason = reason;
        this.pdfViewer.currentScale = value;
        return true;
    }

    async setZoomMode(mode, reason = "Command") {
        if (!this.pdfDocument) return false;
        this.options.zoomMode = mode;
        this.lastZoomReason = reason;
        this.applyZoomMode(mode);
        return true;
    }

    async setRotation(rotation) {
        if (!this.pdfDocument) return false;
        this.pdfViewer.pagesRotation = this.normalizeRotation(rotation);
        this.root.dataset.cgPdfRotation = String(this.pdfViewer.pagesRotation);
        this.decoratePages();
        return true;
    }

    async find(text, findPrevious) {
        if (!this.pdfDocument) return false;
        const query = String(text ?? "");
        const type = query === this.lastSearchText && query ? "again" : "";
        this.lastSearchText = query;
        this.lastPageReason = "Search";
        this.eventBus.dispatch("find", {
            source: this,
            type,
            query,
            phraseSearch: true,
            caseSensitive: false,
            entireWord: false,
            highlightAll: true,
            findPrevious: !!findPrevious,
            matchDiacritics: false,
        });
        return true;
    }

    async clearSearch() {
        this.lastSearchText = "";
        this.eventBus.dispatch("findbarclose", { source: this });
        void this.safeDotNet("OnSearchCompletedAsync", this.activeGeneration, "", 0, 0);
        return true;
    }

    async setSidebarMode(mode) {
        if (!this.sidebarContent) return false;
        this.sidebarObserver?.disconnect();
        this.sidebarObserver = null;
        this.sidebarContent.replaceChildren();
        if (!this.pdfDocument || mode === "None") return true;
        if (mode === "Outline") await this.buildOutline();
        else await this.buildThumbnails();
        return true;
    }

    async buildOutline() {
        const list = document.createElement("ul");
        list.className = "cg-pdf-viewer__outline";
        const addItems = (items, parent) => {
            for (const item of items || []) {
                const row = document.createElement("li");
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = item.title || "Untitled section";
                button.addEventListener("click", () => {
                    this.lastPageReason = "Outline";
                    void this.linkService.goToDestination(item.dest);
                }, { signal: this.abortController.signal });
                row.append(button);
                if (item.items?.length) {
                    const nested = document.createElement("ul");
                    addItems(item.items, nested);
                    row.append(nested);
                }
                parent.append(row);
            }
        };
        addItems(this.outline, list);
        if (!list.children.length) {
            const empty = document.createElement("p");
            empty.textContent = this.options.noOutlineText || "No outline is available.";
            this.sidebarContent.append(empty);
        } else {
            this.sidebarContent.append(list);
        }
    }

    async buildThumbnails() {
        const fragment = document.createDocumentFragment();
        for (let pageNumber = 1; pageNumber <= this.pdfDocument.numPages; pageNumber++) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cg-pdf-viewer__thumbnail";
            button.dataset.pageNumber = String(pageNumber);
            button.setAttribute("aria-label", `Go to page ${pageNumber}`);
            button.innerHTML = `<span>Page ${pageNumber}</span>`;
            button.addEventListener("click", () => {
                this.lastPageReason = "Thumbnail";
                this.pdfViewer.currentPageNumber = pageNumber;
            }, { signal: this.abortController.signal });
            fragment.append(button);
        }
        this.sidebarContent.append(fragment);
        this.sidebarObserver = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting || entry.target.dataset.rendered === "true") continue;
                entry.target.dataset.rendered = "true";
                void this.renderThumbnail(entry.target, Number(entry.target.dataset.pageNumber), this.activeGeneration);
            }
        }, { root: this.sidebarContent, rootMargin: "180px 0px" });
        this.sidebarContent.querySelectorAll(".cg-pdf-viewer__thumbnail").forEach(node => this.sidebarObserver.observe(node));
        this.updateCurrentThumbnail(this.pdfViewer.currentPageNumber);
    }

    async renderThumbnail(button, pageNumber, generation) {
        try {
            const page = await this.pdfDocument.getPage(pageNumber);
            if (generation !== this.activeGeneration || this.disposed) return;
            const viewport = page.getViewport({ scale: .24 });
            const canvas = document.createElement("canvas");
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.ceil(viewport.width * ratio);
            canvas.height = Math.ceil(viewport.height * ratio);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            const context = canvas.getContext("2d", { alpha: false });
            await page.render({ canvasContext: context, viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] }).promise;
            if (generation !== this.activeGeneration || this.disposed) return;
            button.prepend(canvas);
        } catch { }
    }

    updateCurrentThumbnail(pageNumber) {
        this.sidebarContent?.querySelectorAll(".cg-pdf-viewer__thumbnail").forEach(button => {
            if (Number(button.dataset.pageNumber) === pageNumber) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
    }

    decoratePages() {
        const pages = this.viewerElement.querySelectorAll(".page");
        pages.forEach((page, index) => {
            page.setAttribute("role", "region");
            page.setAttribute("aria-label", `Page ${index + 1} of ${this.pdfDocument?.numPages ?? pages.length}`);
            page.dataset.cgPageLabel = this.options.showPageNumbers === false ? "" : String(index + 1);
        });
        this.root.style.setProperty("--cg-pdf-page-number-display", this.options.showPageNumbers === false ? "none" : "block");
    }

    async submitPassword(password) {
        if (!this.passwordCallback) return false;
        const callback = this.passwordCallback;
        this.passwordCallback = null;
        callback(String(password ?? ""));
        return true;
    }

    async cancelPassword() {
        this.passwordCanceled = true;
        this.passwordCallback = null;
        try { await this.loadingTask?.destroy(); } catch { }
        return true;
    }

    async download(fileName) {
        if (!this.pdfDocument) return false;
        const data = await this.pdfDocument.getData();
        const url = this.createObjectUrl(data);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = String(fileName || "document.pdf");
        anchor.rel = "noopener";
        anchor.hidden = true;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => this.revokeObjectUrl(url), 1000);
        return true;
    }

    async print() {
        if (!this.pdfDocument) return false;
        const data = await this.pdfDocument.getData();
        const url = this.createObjectUrl(data);
        const frame = document.createElement("iframe");
        frame.title = "PDF print document";
        frame.hidden = true;
        frame.src = url;
        frame.addEventListener("load", () => {
            this.root.dispatchEvent(new CustomEvent("cg-pdf-print-prepared", { bubbles: true }));
            try {
                frame.contentWindow?.focus();
                frame.contentWindow?.print();
            } catch { }
        }, { once: true });
        document.body.append(frame);
        window.setTimeout(() => {
            frame.remove();
            this.revokeObjectUrl(url);
        }, 60000);
        return true;
    }

    async enterFullscreen() {
        if (!this.root.requestFullscreen) return false;
        await this.root.requestFullscreen();
        return true;
    }

    async exitFullscreen() {
        if (!document.fullscreenElement) return true;
        await document.exitFullscreen();
        return true;
    }

    async interceptLink(event) {
        const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (!anchor || !this.root.contains(anchor)) return;
        if (this.root.getAttribute("aria-disabled") === "true") {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        let uri;
        try { uri = new URL(anchor.href, document.baseURI); } catch { return; }
        if (uri.hash && uri.origin === location.origin && uri.pathname === location.pathname) return;
        if (!["http:", "https:", "mailto:", "tel:"].includes(uri.protocol)) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (!this.options.allowExternalLinks) return;
        const allowed = await this.safeDotNet("OnExternalLinkOpeningAsync", this.activeGeneration, uri.href, this.pdfViewer.currentPageNumber);
        if (!allowed) return;
        if (this.options.openExternalLinksInNewWindow) {
            const opened = window.open(uri.href, "_blank", "noopener,noreferrer");
            if (opened) opened.opener = null;
        } else {
            location.assign(uri.href);
        }
    }

    async handleKeyDown(event) {
        if (event.defaultPrevented || this.disposed || this.root.getAttribute("aria-disabled") === "true") return;
        const editable = event.target instanceof Element && !!event.target.closest("input, textarea, select, [contenteditable='true']");
        const command = event.ctrlKey || event.metaKey;
        if (command && event.key.toLowerCase() === "f") {
            event.preventDefault();
            await this.safeDotNet("OnOpenSearchRequestedAsync");
            return;
        }
        if (editable || !this.pdfDocument) return;
        if (event.key === "F3") {
            event.preventDefault();
            await this.find(this.lastSearchText, event.shiftKey);
            return;
        }
        if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            await this.setZoom(this.pdfViewer.currentScale * 1.1);
        } else if (event.key === "-") {
            event.preventDefault();
            await this.setZoom(this.pdfViewer.currentScale / 1.1);
        } else if (event.key === "0") {
            event.preventDefault();
            await this.setZoomMode("ActualSize");
        } else if (event.key === "PageDown") {
            event.preventDefault();
            if (this.options.continuousScroll) this.viewport.scrollBy({ top: this.viewport.clientHeight * .9, behavior: this.reducedMotion() ? "auto" : "smooth" });
            else await this.goToPage(this.pdfViewer.currentPageNumber + 1);
        } else if (event.key === "PageUp") {
            event.preventDefault();
            if (this.options.continuousScroll) this.viewport.scrollBy({ top: -this.viewport.clientHeight * .9, behavior: this.reducedMotion() ? "auto" : "smooth" });
            else await this.goToPage(this.pdfViewer.currentPageNumber - 1);
        } else if (event.key === "Home") {
            event.preventDefault();
            await this.goToPage(1);
        } else if (event.key === "End") {
            event.preventDefault();
            await this.goToPage(this.pdfDocument.numPages);
        }
    }

    applyZoomMode(mode, customZoom) {
        const values = {
            ActualSize: "page-actual",
            FitWidth: "page-width",
            FitPage: "page-fit",
            FitVisible: "auto",
        };
        if (mode === "Custom") {
            this.pdfViewer.currentScale = Math.min(
                Number(this.options.maximumZoom),
                Math.max(Number(this.options.minimumZoom), Number(customZoom || this.options.zoom || 1)));
        } else {
            this.pdfViewer.currentScaleValue = values[mode] || "page-width";
        }
    }

    zoomModeFromValue(value) {
        const values = {
            "page-actual": "ActualSize",
            "page-width": "FitWidth",
            "page-fit": "FitPage",
            auto: "FitVisible",
        };
        return values[value] || "Custom";
    }

    clampPage(pageNumber) {
        return Math.max(1, Math.min(this.pdfDocument?.numPages || 1, Number(pageNumber) || 1));
    }

    normalizeRotation(rotation) {
        const value = Number(rotation) || 0;
        return ((value % 360) + 360) % 360;
    }

    isSupportedMime(value) {
        if (!value) return true;
        const mime = String(value).split(";", 1)[0].trim().toLowerCase();
        return mime === "application/pdf" || mime === "application/octet-stream";
    }

    reducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    createObjectUrl(data) {
        const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
        this.objectUrls.add(url);
        return url;
    }

    revokeObjectUrl(url) {
        if (!this.objectUrls.delete(url)) return;
        URL.revokeObjectURL(url);
    }

    failure(errorCode, errorMessage) {
        return { succeeded: false, canceled: false, errorCode, errorMessage };
    }

    mapError(error, overrideCode) {
        if (overrideCode) return this.failure(overrideCode, "The PDF exceeded a configured resource limit.");
        const name = String(error?.name || "");
        const message = String(error?.message || "").toLowerCase();
        if (name === "PasswordException") {
            return this.failure(message.includes("incorrect") ? "IncorrectPassword" : "UnsupportedEncryption", "The PDF could not be decrypted.");
        }
        if (name === "MissingPDFException" || name === "UnexpectedResponseException") return this.failure("NetworkFailure", "The PDF could not be downloaded.");
        if (name === "InvalidPDFException") {
            return this.failure(message.includes("eof") || message.includes("truncated") ? "TruncatedDocument" : "UnsupportedDocument", "The PDF is invalid or unsupported.");
        }
        if (name === "AbortException") return { succeeded: false, canceled: true };
        return this.failure("UnsupportedDocument", "The PDF could not be opened.");
    }

    async safeDotNet(method, ...args) {
        if (this.disposed) return null;
        try { return await this.dotNet.invokeMethodAsync(method, ...args); } catch { return null; }
    }

    async dispose() {
        if (this.disposed) return;
        this.disposed = true;
        clearTimeout(this.resizeTimer);
        clearTimeout(this.scrollTimer);
        this.abortController.abort();
        this.resizeObserver?.disconnect();
        this.sidebarObserver?.disconnect();
        await this.destroyDocument();
        for (const url of [...this.objectUrls]) this.revokeObjectUrl(url);
        try { await this.l10n?.destroy?.(); } catch { }
        this.viewerStylesheet?.remove();
        this.root.style.removeProperty("--cg-pdf-text-selection");
        this.viewerElement.replaceChildren();
    }
}

export async function create(root, viewport, viewerElement, sidebar, dotNet, options) {
    const pdfjsRoot = new URL(options.assetBaseUrl || "/cashgear-ui/pdfjs/", document.baseURI);
    const pdfjsModule = new URL("build/pdf.mjs", pdfjsRoot).href;
    const pdfjsViewerModule = new URL("web/pdf_viewer.mjs", pdfjsRoot).href;
    // The prebuilt viewer module resolves the core API from this global while
    // it is evaluated, so the core module must be loaded and exposed first.
    const pdfjs = await import(/* @vite-ignore */ pdfjsModule);
    globalThis.pdfjsLib = pdfjs;
    const viewerLib = await import(/* @vite-ignore */ pdfjsViewerModule);
    return new CgPdfController(root, viewport, viewerElement, sidebar, dotNet, options, pdfjsRoot, pdfjs, viewerLib);
}
