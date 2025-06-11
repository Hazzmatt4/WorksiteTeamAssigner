'use client';

import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  VStack,
  Heading,
  Text,
  useToast,
  SimpleGrid,
  useColorModeValue,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import type { ParseResult } from 'papaparse';

interface ClientData {
  name: string;
  address: string;
  travelTime: string;
  preferredDay?: string;
  jobLength?: string;
}

interface ErrorWithMessage {
  message: string;
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;

  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    // fallback in case there's an error stringifying the maybeError
    // like with circular references for example.
    return new Error(String(maybeError));
  }
}

// Helper to parse sessions and teams required from jobLength
function parseSessionAndTeams(jobLength: string): { sessions: number; teams: number } {
  const lower = jobLength.toLowerCase();
  let sessions = 1;
  let teams = 1;
  if (lower.includes('full')) sessions = 2;
  if (lower.includes('half')) sessions = 1;
  if (lower.match(/\b2\s*teams?\b/)) teams = 2;
  if (lower.match(/\b3\s*teams?\b/)) teams = 3;
  if (lower.match(/\b4\s*teams?\b/)) teams = 4;
  return { sessions, teams };
}

// Helper to abbreviate date/session notes
function abbreviateDateRequested(input: string | undefined): string {
  if (!input || !input.trim()) return 'Any Day';
  const val = input.trim().toLowerCase();
  if (val === 'any' || val === 'any day') return 'Any Day';
  let norm = val.replace(/morning/g, 'am').replace(/afternoon/g, 'pm');
  // Monday
  if (norm === 'monday') return 'Mon Any';
  if (norm.includes('monday')) {
    if (norm.includes('pm')) return 'Mon PM';
    if (norm.includes('am')) return 'Mon AM';
    return 'Mon Any';
  }
  // Tuesday
  if (norm === 'tuesday') return 'Tues Any';
  if (norm.includes('tuesday')) {
    if (norm.includes('pm')) return 'Tues PM';
    if (norm.includes('am')) return 'Tues AM';
    return 'Tues Any';
  }
  // Wednesday
  if (norm === 'wednesday') return 'Wed Any';
  if (norm.includes('wednesday')) {
    if (norm.includes('pm')) return 'Wed PM';
    if (norm.includes('am')) return 'Wed AM';
    return 'Wed Any';
  }
  // Abbreviated forms
  if (norm === 'mon') return 'Mon Any';
  if (norm === 'tue' || norm === 'tues') return 'Tues Any';
  if (norm === 'wed') return 'Wed Any';
  if (norm.includes('mon')) {
    if (norm.includes('pm')) return 'Mon PM';
    if (norm.includes('am')) return 'Mon AM';
    return 'Mon Any';
  }
  if (norm.includes('tue') || norm.includes('tues')) {
    if (norm.includes('pm')) return 'Tues PM';
    if (norm.includes('am')) return 'Tues AM';
    return 'Tues Any';
  }
  if (norm.includes('wed')) {
    if (norm.includes('pm')) return 'Wed PM';
    if (norm.includes('am')) return 'Wed AM';
    return 'Wed Any';
  }
  if (norm.includes('am')) return norm.toUpperCase();
  if (norm.includes('pm')) return norm.toUpperCase();
  return input;
}

// List of all possible sessions
const ALL_SESSIONS = [
  'Mon AM', 'Mon PM',
  'Tues AM', 'Tues PM',
  'Wed AM', 'Wed PM',
];

// Helper to get all available sessions, or filter by requested
function getAvailableSessions(requested: string | undefined): string[] {
  if (!requested || requested === 'Any Day') return ALL_SESSIONS;
  // If a specific session is requested, return only that
  if (ALL_SESSIONS.includes(requested)) return [requested];
  // If only a day is specified (e.g., 'Mon Any'), return both sessions for that day
  if (requested.startsWith('Mon')) return ['Mon AM', 'Mon PM'];
  if (requested.startsWith('Tues')) return ['Tues AM', 'Tues PM'];
  if (requested.startsWith('Wed')) return ['Wed AM', 'Wed PM'];
  return ALL_SESSIONS;
}

// Scheduling function
function assignSessionsToTeams(
  clients: ClientData[],
  teamNames: string[]
): { assignments: { team: string; client: ClientData; session: string }[]; teamSessions: Record<string, string[]> } {
  // Track sessions assigned to each team
  const teamSessions: Record<string, string[]> = {};
  teamNames.forEach((team) => (teamSessions[team] = []));
  // Track assignments
  const assignments: { team: string; client: ClientData; session: string }[] = [];

  // For each client/worksite
  clients.forEach((client) => {
    const { sessions, teams } = parseSessionAndTeams(client.jobLength || '');
    const requested = abbreviateDateRequested(client.preferredDay);
    const possibleSessions = getAvailableSessions(requested);
    let sessionsNeeded = sessions;
    const usedSessions: string[] = [];

    // For each required session
    for (let s = 0; s < sessionsNeeded; s++) {
      // Find the earliest available session not already used for this client
      const available = possibleSessions.filter((sess) => !usedSessions.includes(sess));
      let sessionToAssign = available[0];
      if (!sessionToAssign) break; // No more available sessions
      usedSessions.push(sessionToAssign);

      // For each team required in this session
      let teamsNeeded = teams;
      // Find teams with the fewest sessions assigned, not already booked for this session
      const sortedTeams = teamNames
        .filter((team) => !teamSessions[team].includes(sessionToAssign) && teamSessions[team].length < 6)
        .sort((a, b) => teamSessions[a].length - teamSessions[b].length);
      for (let t = 0; t < teamsNeeded; t++) {
        const team = sortedTeams[t];
        if (!team) break; // Not enough teams available
        teamSessions[team].push(sessionToAssign);
        assignments.push({ team, client, session: sessionToAssign });
      }
    }
  });
  return { assignments, teamSessions };
}

export default function Home() {
  const [csvData, setCsvData] = useState<ClientData[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [teamNames, setTeamNames] = useState<string[]>(['Team 1', 'Team 2']);
  const [assignments, setAssignments] = useState<{ [key: string]: { client: ClientData; session: string }[] }>({});
  const [sessionAssignments, setSessionAssignments] = useState<{ team: string; client: ClientData; session: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const bgColor = useColorModeValue('gray.50', 'gray.700');

  const parseCSV = (text: string): ClientData[] => {
    const parsed: ParseResult<string[]> = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
    });
    if (!parsed.data || parsed.data.length < 2) return [];
    const header: string[] = parsed.data[0];
    const rows: string[][] = parsed.data.slice(1) as string[][];
    return rows
      .filter((row: string[]) => row.join() !== header.join())
      .map((columns: string[]) => ({
        name: columns[0]?.replace('*', '').trim() || '',
        address: columns[1] || '',
        travelTime: columns[4] || '',
        preferredDay: columns[10] || '',
        jobLength: columns[11] || '',
      }));
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsedData = parseCSV(text);
        setCsvData(parsedData);
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: false,
  });

  const handleNumTeamsChange = (value: number) => {
    setNumTeams(value);
    // Update team names array when number of teams changes
    const newTeamNames = Array.from({ length: value }, (_, i) => 
      teamNames[i] || `Team ${i + 1}`
    );
    setTeamNames(newTeamNames);
  };

  const handleTeamNameChange = (index: number, value: string) => {
    const newTeamNames = [...teamNames];
    newTeamNames[index] = value;
    setTeamNames(newTeamNames);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (csvData.length === 0) {
        throw new Error('Please upload a CSV file first');
      }

      // Assign sessions to teams
      const { assignments, teamSessions } = assignSessionsToTeams(csvData, teamNames);
      // Group by team for display
      const grouped: { [key: string]: { client: ClientData; session: string }[] } = {};
      teamNames.forEach((team) => (grouped[team] = []));
      assignments.forEach(({ team, client, session }) => {
        grouped[team].push({ client, session });
      });
      setAssignments(grouped);
      setSessionAssignments(assignments);
    } catch (error: unknown) {
      const errorWithMessage = toErrorWithMessage(error);
      toast({
        title: 'Error',
        description: errorWithMessage.message || 'Failed to process the CSV file',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h1" size="xl" textAlign="center">
          Worksite Team Assigner
        </Heading>

        <Box as="form" onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Upload CSV File</FormLabel>
              <Box
                {...getRootProps()}
                p={10}
                border="2px dashed"
                borderColor={isDragActive ? 'blue.400' : borderColor}
                borderRadius="md"
                bg={isDragActive ? 'blue.50' : bgColor}
                cursor="pointer"
                transition="all 0.2s"
                _hover={{ borderColor: 'blue.400' }}
              >
                <input {...getInputProps()} />
                <Text textAlign="center">
                  {isDragActive
                    ? 'Drop the CSV file here'
                    : 'Drag and drop a CSV file here, or click to select'}
                </Text>
                {csvData.length > 0 && (
                  <Text textAlign="center" mt={2} color="green.500">
                    {csvData.length} clients loaded
                  </Text>
                )}
              </Box>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Number of Teams</FormLabel>
              <NumberInput
                min={2}
                max={20}
                value={numTeams}
                onChange={(_, value) => handleNumTeamsChange(value)}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>

            <FormControl>
              <FormLabel>Team Names</FormLabel>
              <SimpleGrid columns={2} spacing={4}>
                {teamNames.map((name, index) => (
                  <Input
                    key={index}
                    value={name}
                    onChange={(e) => handleTeamNameChange(index, e.target.value)}
                    placeholder={`Team ${index + 1}`}
                  />
                ))}
              </SimpleGrid>
            </FormControl>

            <Button
              type="submit"
              colorScheme="blue"
              isLoading={isLoading}
              loadingText="Processing..."
              width="full"
              isDisabled={csvData.length === 0}
            >
              Assign Teams
            </Button>
          </VStack>
        </Box>

        {csvData.length > 0 && (
          <Box mt={8}>
            <Heading as="h2" size="md" mb={4}>
              Worksite Session & Team Requirements
            </Heading>
            <Table variant="striped" size="sm">
              <Thead>
                <Tr>
                  <Th>Client Name</Th>
                  <Th>Date Requested</Th>
                  <Th>Sessions Needed</Th>
                  <Th>Teams Required</Th>
                </Tr>
              </Thead>
              <Tbody>
                {csvData.map((client, idx) => {
                  const { sessions, teams } = parseSessionAndTeams(client.jobLength || '');
                  // Use column K (index 10) for date requested, abbreviate
                  const dateRequested = abbreviateDateRequested(client.preferredDay);
                  return (
                    <Tr key={idx}>
                      <Td>{client.name}</Td>
                      <Td>{dateRequested}</Td>
                      <Td>{sessions}</Td>
                      <Td>{teams}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}

        {Object.keys(assignments).length > 0 && (
          <Box mt={8}>
            <Heading as="h2" size="lg" mb={4}>
              Team Assignments
            </Heading>
            {Object.entries(assignments).map(([team, clientSessions]) => (
              <Box key={team} mb={8} p={4} borderWidth={1} borderRadius="md">
                <Heading as="h3" size="md" mb={4}>
                  {team}
                </Heading>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Client Name</Th>
                      <Th>Assigned Session</Th>
                      <Th>Address</Th>
                      <Th>Travel Time</Th>
                      <Th>Job Length</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {clientSessions.map(({ client, session }, index) => (
                      <Tr key={index}>
                        <Td>{client.name}</Td>
                        <Td>{session}</Td>
                        <Td>{client.address}</Td>
                        <Td>{client.travelTime}</Td>
                        <Td>{client.jobLength || 'Not specified'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            ))}
          </Box>
        )}
      </VStack>
    </Container>
  );
}
