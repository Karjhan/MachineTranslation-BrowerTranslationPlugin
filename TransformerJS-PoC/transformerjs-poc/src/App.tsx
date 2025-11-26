import { useState } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import FileViewer from './components/file-viewer/FileViewer';
import './App.css';
import TopBar from './components/top-bar/TopBar';
import Chatbot from './components/chat-bot/Chatbot';

function App() {
  const [resultData, setResultData] = useState<{
    progress: number;
    total: number;
    percent: number;
    done: boolean;
    result: {
      relations: [string, string][];
      normalized: [string, string][];
    };
  } | null>(null);
  const [contextText, setContextText] = useState('');

  return (
    <Container className="mw-100 h-100 p-0 m-0">
      <Row className="mw-100 p-0 m-0"></Row>
        <Col className="p-0 m-0">
          <TopBar/>
        </Col>
      <Row className="mw-100 p-0 m-0">
        <Col xl={8} xs={12} className="p-0 m-0 column-left">
          <FileViewer setResultData={setResultData} setContextText={setContextText}/>
        </Col>
        <Col xl={4} xs={12} className="p-0 m-0 column-top">
          <Chatbot contextText={contextText} />
        </Col>
      </Row>
      <Row className="mw-100 p-0 m-0"></Row>
    </Container>
  );
}

export default App;
