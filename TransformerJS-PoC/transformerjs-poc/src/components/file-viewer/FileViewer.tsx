import React, { useState, useEffect } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import { Button, Form, ProgressBar } from 'react-bootstrap';
import { extractPdfText } from '../../utils/pdfUtil'; // assumes you made this helper
const baseUrl = import.meta.env.VITE_BACKEND_URL;
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './FileViewer.css';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

type Props = {
  setResultData: React.Dispatch<
    React.SetStateAction<{
      progress: number;
      total: number;
      percent: number;
      done: boolean;
      result: {
        relations: [string, string][];
        normalized: [string, string][];
      };
    } | null>
  >;
  setContextText: React.Dispatch<React.SetStateAction<string>>;
};

const FileViewer: React.FC<Props> = ({ setResultData, setContextText }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('');
  const [numPages, setNumPages] = useState<number | null>(null);
  const [textContent, setTextContent] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setFileType(uploadedFile.type);
    setTaskId(null);
    setProgress(0);
    setCheckingStatus(false);
    setResultData(null);
    setContextText('');
    setTextContent('');

    if (uploadedFile.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          const text =
            typeof reader.result === 'string'
              ? reader.result
              : new TextDecoder().decode(reader.result);
          setTextContent(text);
          setContextText(text);
        }
      };
      reader.readAsText(uploadedFile);
    } else if (uploadedFile.type === 'application/pdf') {
      const text = await extractPdfText(uploadedFile);
      setContextText(text);
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileType('');
    setNumPages(null);
    setTextContent('');
    setTaskId(null);
    setProgress(0);
    setCheckingStatus(false);
    setResultData(null);
    setContextText('');
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  useEffect(() => {
    if (!taskId || !checkingStatus) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${baseUrl}/status/${taskId}`);
        const data = await res.json();
        setProgress(data.percent || 0);
        if (data.done) {
          setResultData(data);
          setCheckingStatus(false);
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Error checking status:', error);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [taskId, checkingStatus, setResultData]);

  const isControlsDisabled = checkingStatus;

  return (
    <div className="viewer-container dark-theme">
      <div className="controls d-flex gap-2 align-items-center justify-content-between">
        <Form.Group controlId="fileUpload">
          <Form.Control
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileUpload}
            className="file-input"
            disabled={isControlsDisabled}
          />
        </Form.Group>

        {file && (
          <Button
            variant="outline-light"
            onClick={clearFile}
            disabled={isControlsDisabled}
          >
            Remove File
          </Button>
        )}
      </div>

      {checkingStatus && (
        <div className="my-2 w-100">
          <ProgressBar
            animated
            striped
            variant="info"
            now={progress}
            label={`${progress}%`}
          />
        </div>
      )}

      <div className="viewer-content">
        {!file && <div className="placeholder">No document selected</div>}

        {file && fileType === 'application/pdf' && (
          <div className="pdf-viewer scroll-box">
            <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
              {Array.from(new Array(numPages ?? 0), (_, index) => (
                <Page key={index} pageNumber={index + 1} />
              ))}
            </Document>
          </div>
        )}

        {file && fileType === 'text/plain' && (
          <pre className="txt-viewer scroll-box">{textContent}</pre>
        )}
      </div>
    </div>
  );
};

export default FileViewer;
