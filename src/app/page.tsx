import React from 'react'
const HomePage = () => {
  return (
    <div className='flex flex-col min-h-screen text-foreground overflow-hidden'>
      <section className='relative z-10 py-24 flex-grow'>
        <div className='container mx-auto px-4'>
          <div className='grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative'>
            {/* CORNER DECORATION */}


            <div className='absolute -top-10 left-0 w-40 h-40 border-l-2 border-t-2'/>


            {/* left side content */}
            <div className='lg:col-span-7 space-y-8 relative'>
              <h1 className='text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight'>
                <div>
                  <span className='text-foreground'>Transform</span>
                </div>
                <div>
                  <span className='text-primary'>Your Body</span>
                </div>
                <div className='pt-2'>
                  <span className='text-foreground'>With Advanced</span>
                </div>
                <div className='pt-2'>
                  <span className='text-foreground'>AI</span>
                  <span className='text-primary'> Technology</span>
                </div>
              </h1>

              {/* Seprator line */}
              <div className='h-px w-full bg-gradient-to-r from-primary via-secondary to-primary opacity-50'></div>
              <p className='text-xl text-muted-foreground w-2/3'>
              Talk to our AI assistant and get personalized diet plans and workout routines
              designed just for you.
              </p>
              {/* STATS */}
              <div className="flex items-center justify-center gap-16 mt-10 font-mono">
                <div className="flex flex-col items-center">
                  <p className="text-3xl text-primary">500+</p>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">
                    PROGRAMS
                  </p>
                </div>
                <div className="w-px h-12 bg-border"></div>
                <div className="flex flex-col items-center">
                  <p className="text-3xl text-primary">3min</p>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">
                    CREATION TIME
                  </p>
                </div>
                <div className="w-px h-12 bg-border"></div>
                <div className="flex flex-col items-center">
                  <p className="text-3xl text-primary">100%</p>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">
                    PERSONALIZED
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
    </div>
  )
}

export default HomePage
