'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { upload } from '@vercel/blob/client';

const initialState = {
  error: null,
  results: [],
};

function SubmitButton({ disabled }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button className="submit-button" type="submit" disabled={isDisabled}>
      {pending ? 'Processing images...' : disabled ? 'Waiting for ready uploads...' : 'Convert images'}
    </button>
  );
}

export default function UploadForm({ action, formatOptions }) {
  const [state, formAction] = useActionState(action, initialState);
  const [showSizingHelp, setShowSizingHelp] = useState(false);
  const [selectedFilesLabel, setSelectedFilesLabel] = useState('No files selected yet.');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sourceUploads, setSourceUploads] = useState([]);
  const [isUploadingSources, setIsUploadingSources] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [shouldRenameImages, setShouldRenameImages] = useState(false);
  const [shouldCreateMobileImages, setShouldCreateMobileImages] = useState(false);
  const [resultItems, setResultItems] = useState([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [clearError, setClearError] = useState(null);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef(null);
  const sizingHelpRef = useRef(null);
  const resultDataRef = useRef({});

  function updateSelectedFilesLabel(files) {
    if (!files || files.length === 0) {
      setSelectedFilesLabel('No files selected yet.');
      return;
    }

    if (files.length === 1) {
      setSelectedFilesLabel(files[0].name);
      return;
    }

    setSelectedFilesLabel(`${files.length} files selected`);
  }

  function syncSelectedFiles(nextFiles) {
    if (fileInputRef.current) {
      const transfer = new DataTransfer();
      nextFiles.forEach((file) => transfer.items.add(file));
      fileInputRef.current.files = transfer.files;
    }

    setSelectedFiles(nextFiles);
    updateSelectedFilesLabel(nextFiles);
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files ?? []);
    syncSelectedFiles(files);
  }

  function handleDragEnter(event) {
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const droppedFiles = event.dataTransfer?.files;

    if (fileInputRef.current && droppedFiles && droppedFiles.length > 0) {
      const imageFiles = Array.from(droppedFiles).filter((file) => file.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        syncSelectedFiles(imageFiles);
      }
    }

    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
  }

  function handleRemoveSelectedFile(indexToRemove) {
    const nextFiles = selectedFiles.filter((_, index) => index !== indexToRemove);
    syncSelectedFiles(nextFiles);
  }

  useEffect(() => {
    let isCancelled = false;

    async function uploadSources() {
      if (selectedFiles.length === 0) {
        setSourceUploads([]);
        setUploadError(null);
        setIsUploadingSources(false);
        return;
      }

      setIsUploadingSources(true);
      setUploadError(null);

      try {
        const uploaded = [];

        for (const file of selectedFiles) {
          const blob = await upload(file.name, file, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            clientPayload: JSON.stringify({ fileName: file.name }),
          });

          uploaded.push({
            fileName: file.name,
            url: blob.url,
          });
        }

        if (!isCancelled) {
          setSourceUploads(uploaded);
        }
      } catch (error) {
        if (!isCancelled) {
          setSourceUploads([]);
          setUploadError(error instanceof Error ? error.message : 'Unable to upload one or more images to Blob.');
        }
      } finally {
        if (!isCancelled) {
          setIsUploadingSources(false);
        }
      }
    }

    uploadSources();

    return () => {
      isCancelled = true;
    };
  }, [selectedFiles]);

  useEffect(() => {
    if (!showSizingHelp) {
      return undefined;
    }

    function handleOutsideClick(event) {
      if (sizingHelpRef.current && !sizingHelpRef.current.contains(event.target)) {
        setShowSizingHelp(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showSizingHelp]);

  useEffect(() => {
    resultDataRef.current = {};

    const items = state.results.map((result) => {
      resultDataRef.current[result.downloadName] = { url: result.url };
      return { ...result, blobUrl: result.url };
    });

    setResultItems(items);
    setClearError(null);
  }, [state.results]);

  function handleClearResults() {
    resultDataRef.current = {};
    setResultItems([]);
    setClearError(null);
    syncSelectedFiles([]);
  }

  async function handleDownloadAllClick() {
    if (isDownloadingZip) {
      return;
    }

    setIsDownloadingZip(true);

    try {
      const { zip } = await import('fflate');
      const files = {};

      for (const [name, { url }] of Object.entries(resultDataRef.current)) {
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('Unable to download one or more generated files.');
        }

        files[name] = new Uint8Array(await response.arrayBuffer());
      }

      zip(files, (err, data) => {
        setIsDownloadingZip(false);

        if (err) {
          setClearError('Unable to build ZIP archive. Try downloading files individually.');
          return;
        }

        const blob = new Blob([data], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'compressed-images.zip';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    } catch (error) {
      setClearError(error instanceof Error ? error.message : 'Unable to create ZIP download.');
      setIsDownloadingZip(false);
    }
  }

  const canDownloadAll = resultItems.length > 0 && Object.keys(resultDataRef.current).length > 0;
  const isSubmitDisabled =
    selectedFiles.length === 0 ||
    isUploadingSources ||
    Boolean(uploadError) ||
    sourceUploads.length !== selectedFiles.length;

  return (
    <section className="tool-grid">
      <form
        className="tool-panel"
        action={formAction}
        onSubmit={(event) => {
          if (isSubmitDisabled) {
            event.preventDefault();
          }
        }}
      >
        <p className="section-label">Controls</p>
        <div className="sizing-help" ref={sizingHelpRef}>
          <button
            type="button"
            className="sizing-help-toggle"
            aria-expanded={showSizingHelp}
            onClick={() => setShowSizingHelp((current) => !current)}
          >
            What size should I make my images?
          </button>

          {showSizingHelp ? (
            <div className="sizing-help-panel" role="region" aria-label="Image sizing recommendations">
              <table className="sizing-help-table">
                <caption>Desktop and mobile suggestions for common website image types.</caption>
                <thead>
                  <tr>
                    <th scope="col">Use case</th>
                    <th scope="col">Desktop max width</th>
                    <th scope="col">Mobile max width</th>
                    <th scope="col">Format</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Blog hero image</td>
                    <td>1200px</td>
                    <td>720px</td>
                    <td>WebP</td>
                  </tr>
                  <tr>
                    <td>Thumbnails / cards</td>
                    <td>500px</td>
                    <td>320px</td>
                    <td>WebP</td>
                  </tr>
                  <tr>
                    <td>Avatars / icons</td>
                    <td>200px</td>
                    <td>120px</td>
                    <td>WebP</td>
                  </tr>
                  <tr>
                    <td>Full-width banner</td>
                    <td>1600px</td>
                    <td>900px</td>
                    <td>WebP</td>
                  </tr>
                </tbody>
              </table>
              <button type="button" className="sizing-help-close" onClick={() => setShowSizingHelp(false)}>
                Close
              </button>
            </div>
          ) : null}
        </div>

        <div className="file-field">
          <span>Images</span>
          <input
            id="images-input"
            ref={fileInputRef}
            className="file-input"
            type="file"
            name="images"
            accept="image/*"
            multiple
            required
            onChange={handleFileChange}
          />
          <label
            className={`file-picker ${isDraggingFiles ? 'is-dragging' : ''}`}
            htmlFor="images-input"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span className="file-picker-icon" aria-hidden="true">
              {isDraggingFiles ? '⬇' : '⤴'}
            </span>
            <span className="file-picker-button">Choose Files</span>
            <span className="file-picker-copy">
              {isDraggingFiles ? 'Release to upload' : 'Drop all images here at once or click to browse'}
            </span>
            <span className="file-picker-meta" aria-live="polite">
              {selectedFilesLabel}
            </span>
          </label>
          <p className="hint">Select a single image or a batch of images.</p>
          <p className="hint">Files upload directly to Blob first, so large batches avoid the server action upload limit.</p>
          {isUploadingSources ? <p className="status-row">Uploading selected images to Blob...</p> : null}
          {uploadError ? <p className="error-banner" role="alert">{uploadError}</p> : null}
          {selectedFiles.length > 0 ? (
            <ul className="selected-files-list" aria-label="Selected images">
              {selectedFiles.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                  className="selected-file-item"
                >
                  <span className="selected-file-name" title={file.name}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="remove-file-button"
                    onClick={() => handleRemoveSelectedFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {sourceUploads.map((uploadItem, index) => (
            <input
              key={`${uploadItem.fileName}-${uploadItem.url}-${index}`}
              type="hidden"
              name="sourceBlobUrls"
              value={uploadItem.url}
            />
          ))}
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Output format</span>
            <select name="format" defaultValue="webp">
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Quality (85 is a good default)</span>
            <input type="number" name="quality" min="1" max="100" defaultValue="85" />
          </label>

          <label className="field">
            <span>Max longest edge (pixels)</span>
            <input type="number" name="maxLength" min="1" defaultValue="500" placeholder="e.g. 1600" />
          </label>
        </div>

        <div className="rename-controls">
          <div className="checkbox-row">
            <label className="rename-toggle" htmlFor="rename-enabled">
              <input
                id="rename-enabled"
                type="checkbox"
                name="renameEnabled"
                checked={shouldRenameImages}
                onChange={(event) => setShouldRenameImages(event.target.checked)}
              />
              <span>Rename Images</span>
            </label>

            <label className="rename-toggle" htmlFor="mobile-resize-enabled">
              <input
                id="mobile-resize-enabled"
                type="checkbox"
                name="mobileResizeEnabled"
                checked={shouldCreateMobileImages}
                onChange={(event) => setShouldCreateMobileImages(event.target.checked)}
              />
              <span>Resize mobile images automatically</span>
            </label>
          </div>

          {shouldCreateMobileImages ? (
            <p className="hint mobile-resize-hint">
              Adds a second download with a <code>-m</code> suffix using the closest desktop-to-mobile size pair
              from the table above.
            </p>
          ) : null}

          {shouldRenameImages ? (
            <label className="field" htmlFor="rename-base">
              <span>Name prefix</span>
              <input
                id="rename-base"
                type="text"
                name="renameBase"
                placeholder="e.g. product-shot"
                maxLength={80}
                required
              />
            </label>
          ) : null}
        </div>

        <div className="submit-row">
          <SubmitButton disabled={isSubmitDisabled} />
          <p className="status-row">Formats supported: WebP, JPEG, PNG.</p>
        </div>

        {state.error ? <p className="error-banner">{state.error}</p> : null}
      </form>

      <section className="results-panel">
        <p className="section-label">Results</p>
        <h2 className="results-heading">Ready to download.</h2>
        {resultItems.length > 0 ? (
          <>
            <div className="results-toolbar">
              {canDownloadAll ? (
                <button
                  type="button"
                  className="download-link"
                  onClick={handleDownloadAllClick}
                  disabled={isDownloadingZip}
                  aria-busy={isDownloadingZip}
                >
                  {isDownloadingZip ? 'Preparing ZIP...' : 'Download all as ZIP'}
                </button>
              ) : null}
              <button
                type="button"
                className="clear-button"
                onClick={handleClearResults}
              >
                Clear
              </button>
            </div>
            <p className="results-summary">
              <strong>{resultItems.length}</strong> processed file{resultItems.length === 1 ? '' : 's'}.
            </p>
            <div className="results-list">
              {resultItems.map((result) => (
                <article className="result-card" key={result.downloadName}>
                  <div className="result-body">
                    <h3>{result.downloadName}</h3>
                    <p className="result-meta">
                      New Name: {result.downloadName}
                      <br />
                      Original Name: {result.originalName}
                      <br />
                      Output: {result.format.toUpperCase()} at {result.width} x {result.height}
                      <br />
                      Size: {result.sizeLabel}
                    </p>
                    <a className="download-link" href={result.blobUrl} download={result.downloadName}>
                      Download file
                    </a>
                  </div>
                </article>
              ))}
            </div>
            {clearError ? <p className="error-banner">{clearError}</p> : null}
          </>
        ) : (
          <p className="empty-state">Converted images will appear here with names, output details, and a direct download link.</p>
        )}
      </section>
    </section>
  );
}