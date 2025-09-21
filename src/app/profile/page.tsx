"use client";
import React from 'react';
import { useUser } from '@clerk/nextjs';

const ProfilePage = () => {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Profile Page</h1>
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Welcome back!</h2>
          <p className="text-muted-foreground">
            {user ? `Hello, ${user.firstName || 'User'}!` : 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
