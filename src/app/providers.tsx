'use client';

import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { useRef } from 'react';

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'white',
        color: 'gray.800',
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref}>
      <ChakraProvider theme={theme}>
        {children}
      </ChakraProvider>
    </div>
  );
} 