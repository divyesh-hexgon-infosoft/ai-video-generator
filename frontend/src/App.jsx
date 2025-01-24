import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import VideoGeneratorApp from './components/prompt.component';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<VideoGeneratorApp />} />
      </Routes>
    </Router>
  );
}


export default App;

