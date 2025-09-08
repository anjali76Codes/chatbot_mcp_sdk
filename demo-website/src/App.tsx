// demo-website/src/App.tsx
import { ChatWindow } from './ChatWindow';
import './App.css';

function App() {
  return (
    <div className="App">
      {/* <h1 className='m-7'>My Website</h1> */}
      {/* <p>Welcome to our fantastic travel tours!</p> */}
      {/* This is where your chatbot gets embedded */}
      <ChatWindow />
    </div>
  );
}

export default App;