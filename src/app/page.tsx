import { TimeEntryForm } from '@/components/chrono-assist/TimeEntryForm';
import { ChronoAssistLogo } from '@/components/chrono-assist/ChronoAssistLogo';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <div className="flex items-center justify-center mb-4">
          <ChronoAssistLogo className="h-16 w-16 text-primary" data-ai-hint="clock logo" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          Chrono<span className="text-primary">Assist</span>
        </h1>
        <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
          Streamline your time tracking with AI-powered suggestions. Focus on your work, not on filling timesheets.
        </p>
      </header>
      
      <main className="w-full max-w-3xl">
        <TimeEntryForm />
      </main>

      <footer className="mt-16 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ChronoAssist. Built with Next.js and AI.</p>
      </footer>
    </div>
  );
}
