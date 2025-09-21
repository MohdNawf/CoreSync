"use client";
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react'
import { useState } from 'react';
import { useRef } from 'react';
import { vapi } from '@/lib/vapi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


const GenerateProgramPage = () => {

  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [callEnded, setCallEnded] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const {user} = useUser()
  const router = useRouter();

  const messageContainerRef = useRef<HTMLDivElement>(null)

  //auto-scroll messages
  useEffect(() =>{
    if(messageContainerRef.current){
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight
    }
  },[messages]);

  //navigate user to profile after call ends

  useEffect(() => {
    if(callEnded){
      console.log("Call ended, redirecting to profile in 1.5 seconds...");
      const redirectTimer = setTimeout(()=>{
        console.log("Redirecting to profile now...");
        router.push("/profile");
      }, 1500);

      return () => clearTimeout(redirectTimer);
    }
  },[callEnded,router])
  
  // setup event listeners for vapi
  useEffect(() =>{
    const handleCallStart =() =>{
      console.log("Call Started");
      setConnecting(false);
      setCallActive(true);
      setCallEnded(false);
      setConnectionError(null);
    }
    
    const handleCallEnd =() =>{
      console.log("Call Ended");
      setCallActive(false);
      setConnecting(false);
      setIsSpeaking(false);
      setCallEnded(true);
      console.log("Call ended state set to true");
    }

    const handleSpeechStart =() =>{
      console.log("AI Started Speaking");
      setIsSpeaking(true);
    }

    const handleSpeechEnd =() =>{
      console.log("AI Stopped Speaking");
      setIsSpeaking(false);
    }

    const handleMessage =(message: any) =>{
      if(message.type === "transcript" && message.transcriptType === "final"){
        const newMessage = {content:message.transcript, role:message.role}
        setMessages(prev =>[...prev,newMessage])
      }
    }
    
    const handleError =(error: any) =>{
      console.log("Vapi Error", error)
      console.log("Error details:", JSON.stringify(error))
      setConnecting(false);
      setCallActive(false);
      
      // Handle specific WebRTC connection errors
      if (error && error.message) {
        if (error.message.includes("send transport changed to disconnected") || 
            error.message.includes("WebRTC") || 
            error.message.includes("connection")) {
          setConnectionError("Connection lost. Please check your internet connection and try again.");
        } else {
          setConnectionError(`Call Error: ${error.message}`);
        }
      } else {
        setConnectionError("Call failed: The assistant ID may not exist. Please check your Vapi dashboard.");
      }
    }
   
    vapi.on("call-start",handleCallStart)
    .on("call-end",handleCallEnd)
    .on("speech-start",handleSpeechStart)
    .on("speech-end",handleSpeechEnd)
    .on("message",handleMessage)
    .on("error",handleError)

    return () => {
      vapi.off("call-start",handleCallStart)
    .off("call-end",handleCallEnd)
    .off("speech-start",handleSpeechStart)
    .off("speech-end",handleSpeechEnd)
    .off("message",handleMessage)
    .off("error",handleError)
    }
  },[]);

  const toggleCall = async () => {
    if(callActive) vapi.stop()
      else{
    try {
      setConnecting(true);
      setMessages([]);
      setCallEnded(false);
      setConnectionError(null);

      const fullName = user?.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      :"Hi There";

      const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "34caa6a5-e59f-4a2a-a0de-9642aabdfe48";
      
      console.log("Starting call with assistant ID:", assistantId);
      console.log("API Key:", process.env.NEXT_PUBLIC_VAPI_API_KEY || "6471346a-3201-42a8-8d8c-bdb65440679f");
      console.log("Full name variable:", fullName);
      
      try {
        await vapi.start(assistantId, {
          variableValues: {
            full_name: fullName
          }
        })
        console.log("Vapi start call succeeded!");
      } catch (startError) {
        console.error("Vapi start failed:", startError);
        console.error("Error type:", typeof startError);
        console.error("Error message:", startError instanceof Error ? startError.message : String(startError));
        throw startError;
      }
    } catch (error) {
      console.error("Error starting call:", error);
      setConnecting(false);
      setCallActive(false);
      alert("Failed to start call. Please check your Vapi configuration.");
    }}
  }
 
  return (
  <div className='flex flex-col min-h-screen text-foreground overflow-hidden pb-6 pt-24'>
    <div className='container mx-auto px-4 h-full max-w-5xl'>
      {/*title */}
      <div className='text-center mb-8'>
        <h1 className='text-3xl font-bold font-mono'>
          <span>Generate Your</span>
          <span className='text-primary uppercase'> Fitness Program</span>
        </h1>
        <p className='text-muted-foreground mt-2'>
          Have a voice conversation with our AI assistant to create your personalized plan
        </p>
      </div>

      {/* voice call area */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
        {/*AI assistant card */}
        <Card className={`bg-card/90 backdrop-blur-sm border overflow-hidden relative ${
          callActive ? "border-primary" : "border-border"
        }`}>
        <div className='aspect-video flex flex-col items-center justify-center p-6 relative'>
          {/*voice animation */}
        <div
                className={`absolute inset-0 ${
                  isSpeaking ? "opacity-30" : "opacity-0"
                } transition-opacity duration-300`}
              >
                {/* Voice wave animation when speaking */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-center items-center h-20">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`mx-1 h-16 w-1 bg-primary rounded-full ${
                        isSpeaking ? "animate-sound-wave" : ""
                      }`}
                      style={{
                        animationDelay: `${i * 0.1}s`,
                        height: isSpeaking ? `${Math.random() * 50 + 20}%` : "5%",
                      }}
                    />
                  ))}
                </div>
              </div>
              {/*ai image */}
              <div className='relative size-32 mb-4'>
                <div
                className={`absolute inset-0 bg-primary opacity-10 rounded-full blur-lg ${
                  isSpeaking ? "animate-pulse":""
                }`}
                />

                <div className='relative w-full h-full rounded-full bg-card flex items-center justify-center border border-border overflow-hidden'>
                  <div className='absolute inset-0 bg-gradient-to-b from-primary/10 to-secondary/10'></div>
                  <img
                  src="/ai1.png"
                  alt='ai assistant'
                  className='w-full h-full object-cover'
                  />
                </div>
              </div>

              <h2 className='text-xl font-bold text-foreground'>CoreSync AI</h2>
              <p className='text-sm text-muted-foreground mt-1'>Fitness & Diet Coach</p>

              {/* speaking indicator */}

              <div className={`mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border ${
                callActive ? "border-primary" : "border-border"
              }`}>

                <div 
                className={`w-2 h-2 rounded-full ${
                  callActive ? "bg-primary animate-pulse":"bg-muted"
                }`}
                />

                <span className='text-xs text-muted-foreground'>
                  {isSpeaking ? "Speaking..." : callActive ? "Listening..." : callEnded ? "Redirecting to profile..." : "Waiting..."}

                </span>
              </div>
        </div>
        </Card>

        {/* user card */}
        <Card className={`bg-card/90 backdrop-blur-sm border overflow-hidden relative`}>
        <div className='aspect-video flex flex-col items-center justify-center p-6 relative'>
          {/*user image*/}
          <div className='relative size-32 mb-4'>
            <img src={user?.imageUrl} alt="User" className='object-cover rounded-full'/>
            </div>
            <h2 className='text-xl font-bold text-foreground'>You</h2>
            <p className='text-sm text-muted-foreground mt-1'>
              {user ? (user.firstName + " " + (user.lastName || "")).trim() : "Guest"}
              </p>
              {/*user ready text*/}
              <div className={`mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border`}>
                <div className={`w-2 h-2 rounded-full bg-muted`}/>
                <span className='text-xs text-muted-foreground'>Ready</span>
              </div>
               </div>
              </Card>

      </div>
      
              {/*messagae container */}
              {messages.length > 0 && (
                <div ref={messageContainerRef}
                className='w-full bg-card/90 backdrop-blur-sm border border-border rounded-xl p-4 mb-8 h-64 overflow-y-auto 
                transition-all duration-300 scroll-smooth'>
                  <div className='space-y-3'>
                    {messages.map((msg, index) => (
                      <div key= {index} className='message-item animate-fadeIn'>
                        <div className='font-semibold text-xs text-muted-foreground mb-1'>
                          {msg.role === "assistant" ? "CoreSync AI" : "You"}:
                        </div>
                        <p className='text-foreground'>{msg.content}</p>
                        </div>
                    ))}
                </div>
              </div>
              )}

              {/*error display */}
              {connectionError && (
                <div className='w-full mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg'>
                  <p className='text-destructive text-sm text-center'>{connectionError}</p>
                </div>
              )}

              {/*call controls */}
              <div className='w-full flex justify-center gap-4'>
                <Button
                className={`w-40 text-xl rounded-3xl ${
                  callActive
                  ? "bg-destructive hover:bg-destructive/90"
                  : callEnded
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-primary hover:bg-primary/90"
                } text-white relative`}

                onClick={toggleCall}
                disabled={connecting || callEnded}
                >
                  {connecting && (
                    <span className='absolute inset-0 rounded-full animate-ping bg-primary/50 opacity-75'></span>
                  )}

                  <span>
                    {callActive
                    ? "End Call"
                  : connecting
                  ? "Connecting..."
                : callEnded
                ? "View Profile"
              : "Start Call"}
                  </span>
                </Button>
              </div>
    </div>
  </div>
)
}

export default GenerateProgramPage;
