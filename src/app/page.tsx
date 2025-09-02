'use client';
import React from 'react'
import { SignedIn, SignedOut, SignInButton, SignOutButton } from '@clerk/nextjs'

const HomePage = () => {
  return (
    <div>
      HomePage
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
      <SignOutButton />
      </SignedIn>
    </div>
  )
}

export default HomePage
