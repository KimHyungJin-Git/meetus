import { useState, useEffect } from 'react';
import SplashPage from './pages/SplashPage';
import MainPage from './pages/MainPage';
import ResultPage from './pages/ResultPage';

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [departurePoints, setDeparturePoints] = useState([]);
  const [midpoint, setMidpoint] = useState(null);
  const [apiResult, setApiResult] = useState(null);

  useEffect(() => {
    if (screen === 'splash') {
      const t = setTimeout(() => setScreen('main'), 2200);
      return () => clearTimeout(t);
    }
  }, [screen]);

  const handleCalculate = (points, mid, result = null) => {
    setDeparturePoints(points);
    setMidpoint(mid);
    setApiResult(result);
    setScreen('result');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-300 p-4">
      <div className="w-[390px] h-[844px] bg-black rounded-[50px] p-[12px] shadow-[0_40px_80px_rgba(0,0,0,0.3)] relative overflow-hidden flex-shrink-0">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-50" />
        <div className="w-full h-full rounded-[40px] overflow-hidden bg-white relative">
          {screen === 'splash' && <SplashPage />}
          {screen === 'main' && (
            <MainPage onCalculate={handleCalculate} />
          )}
          {screen === 'result' && (
            <ResultPage
              departurePoints={departurePoints}
              midpoint={midpoint}
              initialApiResult={apiResult}
              onBack={() => setScreen('main')}
            />
          )}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-black/10 rounded-full z-50 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
