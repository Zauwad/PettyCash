import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

function useTypewriter(text, speed = 35, delay = 100) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setCurrentIndex(0);
      setIsComplete(false);
      return;
    }
    setCurrentIndex(0);
    setIsComplete(false);
    
    let timer;
    const startTimeout = setTimeout(() => {
      timer = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          if (prevIndex >= text.length) {
            clearInterval(timer);
            setIsComplete(true);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      if (timer) clearInterval(timer);
    };
  }, [text, speed, delay]);

  const displayedText = text ? text.slice(0, currentIndex) : '';
  return { text: displayedText, isComplete };
}

export function WelcomeGreeting({ user, isExecutive, isCEO }) {
  const getDhakaGreeting = () => {
    const utc = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
    const dhakaTime = new Date(utc + 3600000 * 6);
    const hours = dhakaTime.getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = user?.first_name || user?.username;
  const greetingText = userName ? `${getDhakaGreeting()}, ${userName}!` : '';
  const { text: typedGreeting, isComplete: isGreetingComplete } = useTypewriter(greetingText, 35, 300);

  return (
    <div className="stagger-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary/10 to-secondary/5 border border-primary/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
      <div className="absolute top-[-50%] right-[-10%] w-[350px] h-[350px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="space-y-2 relative z-10">
        <h2 className="text-3xl md:text-4xl font-extrabold Outfit tracking-tight min-h-[40px] flex items-center">
          {typedGreeting}
          {!isGreetingComplete && (
            <span className="inline-block w-[3px] h-[26px] bg-primary ml-1 animate-pulse" />
          )}
        </h2>
        <p className={`text-sm text-base-content/70 transition-all duration-700 ease-out transform ${
          isGreetingComplete 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-1.5 pointer-events-none'
        }`}>
          Welcome back to <span className="font-semibold text-primary">{user?.organization?.name}</span> portal.
          {isExecutive && ' Here is the executive dashboard overview.'}
          {!isExecutive && ` You are logged into the ${user?.profile?.department?.name || 'Central'} department.`}
        </p>
      </div>
      {!isCEO && (
        <div className="flex gap-3 relative z-10">
          <Link to="/petty-cash" className="btn btn-primary btn-sm rounded-xl font-bold gap-1.5 shadow-md shadow-primary/20">
            <PlusCircle className="w-4 h-4" />
            Petty Cash Requisition
          </Link>
          <Link to="/leave" className="btn btn-primary btn-sm rounded-xl font-bold gap-1.5 shadow-md shadow-secondary/20">
            <PlusCircle className="w-4 h-4" />
            Apply Leave
          </Link>
        </div>
      )}
    </div>
  );
}
export default WelcomeGreeting;
