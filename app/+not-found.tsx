import React from 'react';
import { Redirect } from 'expo-router';
// Any path we don't know (including a hosting sub-path) lands on the gate.
export default function NotFound() { return <Redirect href="/" />; }
