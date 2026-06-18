import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leaveApi } from '../api/leaveApi';
import { PageTransition } from '@/shared/components/ui/PageTransition';
import { LoadingSkeleton } from '@/shared/components/ui/LoadingSkeleton';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft,
  Users,
  Calendar,
  AlertCircle
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  parseISO
} from 'date-fns';

export function LeaveCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const month = currentDate.getMonth() + 1; // 1-indexed
  const year = currentDate.getFullYear();

  // Query: Team calendar absences
  const { data: absences, isLoading, isError } = useQuery({
    queryKey: ['team-calendar', month, year],
    queryFn: () => leaveApi.getTeamCalendar(month, year),
  });

  // Calendar calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Day of week index for the first day (0 = Sun, 1 = Mon, ... 5 = Fri, 6 = Sat)
  const startDayOfWeek = getDay(monthStart);
  
  // Standard weekends in BD: Friday and Saturday (5 and 6)
  const BD_WEEKENDS = [5, 6]; 

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Filter leaves that cover a specific day
  const getAbsencesForDay = (day) => {
    if (!absences) return [];
    
    return absences.filter(abs => {
      const start = parseISO(abs.start_date);
      const end = parseISO(abs.end_date);
      
      // Zero out hours to compare dates only
      const dayTime = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      
      return dayTime >= startTime && dayTime <= endTime;
    });
  };

  return (
    <PageTransition>
      <div className="space-y-6 pb-12">
        {/* Back link */}
        <Link to="/leave" className="btn btn-ghost btn-xs text-base-content/60 hover:text-secondary rounded-md gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Leave management
        </Link>

        {/* Toolbar header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-200/50 p-6 rounded-2xl border border-base-content/5">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold Outfit text-base-content flex items-center gap-2">
              <Users className="w-6 h-6 text-secondary" />
              Team Calendar
            </h2>
            <p className="text-xs text-base-content/50">
              Absence schedules of all employees out on approved leave
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <h3 className="text-sm font-bold Outfit text-base-content px-2 uppercase tracking-wide">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            
            <div className="flex gap-1.5">
              <button 
                onClick={handlePrevMonth}
                className="btn btn-ghost btn-circle btn-sm text-base-content border border-base-content/10 hover:bg-base-content/5"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={handleToday}
                className="btn btn-ghost btn-sm text-xs rounded-lg border border-base-content/10 hover:bg-base-content/5 font-bold"
              >
                Today
              </button>
              <button 
                onClick={handleNextMonth}
                className="btn btn-ghost btn-circle btn-sm text-base-content border border-base-content/10 hover:bg-base-content/5"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid Container */}
        {isLoading ? (
          <div className="skeleton w-full h-[550px] rounded-3xl"></div>
        ) : isError ? (
          <div className="alert alert-error rounded-2xl flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-error-content shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Calendar load failed</h4>
              <p className="text-xs text-error-content/85 mt-1">Failed to fetch the schedule of approved absences.</p>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-4 md:p-6 rounded-3xl shadow-xl border border-base-content/5 overflow-x-auto">
            <div className="min-w-[700px] space-y-4">
              {/* Day header names */}
              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase text-base-content/40 tracking-widest pb-2 border-b border-base-content/5">
                <div>Sunday</div>
                <div>Monday</div>
                <div>Tuesday</div>
                <div>Wednesday</div>
                <div>Thursday</div>
                <div className="text-secondary">Friday</div>
                <div className="text-secondary">Saturday</div>
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-2 min-h-[420px]">
                {/* Empty cells before month start */}
                {Array.from({ length: startDayOfWeek }).map((_, idx) => (
                  <div 
                    key={`empty-${idx}`} 
                    className="bg-base-300/10 rounded-2xl border border-dashed border-base-content/5 min-h-[90px]"
                  ></div>
                ))}

                {/* Days of month */}
                {daysInMonth.map((day) => {
                  const dayNum = day.getDate();
                  const dayOfWeek = getDay(day);
                  const isWeekend = BD_WEEKENDS.includes(dayOfWeek);
                  const isToday = isSameDay(day, new Date());
                  const dayAbsences = getAbsencesForDay(day);

                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`rounded-2xl p-2 flex flex-col justify-between min-h-[100px] border transition-all duration-200 relative overflow-hidden group ${
                        isToday 
                          ? 'bg-secondary/5 border-secondary/35 shadow-md shadow-secondary/5' 
                          : isWeekend 
                          ? 'bg-base-200/20 border-base-content/5' 
                          : 'bg-base-100/30 border-base-content/5 hover:border-base-content/10'
                      }`}
                    >
                      {/* Day number */}
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg ${
                        isToday 
                          ? 'bg-secondary text-secondary-content font-black' 
                          : isWeekend 
                          ? 'text-base-content/30' 
                          : 'text-base-content/65'
                      }`}>
                        {dayNum}
                      </span>

                      {/* Absences list in cell */}
                      <div className="space-y-1.5 mt-2 overflow-y-auto max-h-[80px]">
                        {dayAbsences.map((abs) => {
                          const isPending = abs.state && abs.state.startsWith('pending');
                          return (
                            <div 
                              key={abs.id} 
                              className={isPending
                                ? "bg-warning/10 hover:bg-warning/20 border-l-3 border-warning text-[10px] font-bold p-1 rounded-md text-warning truncate cursor-pointer transition-colors duration-150"
                                : "bg-secondary/15 hover:bg-secondary/25 border-l-3 border-secondary text-[10px] font-bold p-1 rounded-md text-secondary truncate cursor-pointer transition-colors duration-150"
                              }
                              title={`${abs.requester?.full_name} (${abs.requester?.department}) - ${abs.leave_type} (${abs.working_days_requested} days)${isPending ? ' [PENDING]' : ''}`}
                            >
                              {abs.requester?.full_name?.split(' ')[0]}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default LeaveCalendarPage;
