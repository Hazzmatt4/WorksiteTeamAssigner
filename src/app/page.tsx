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

export default function Home() {
  const [csvData, setCsvData] = useState<ClientData[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [teamNames, setTeamNames] = useState<string[]>(['Team 1', 'Team 2']);
  const [assignments, setAssignments] = useState<{ [key: string]: ClientData[] }>({});
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const bgColor = useColorModeValue('gray.50', 'gray.700');

  const parseCSV = (text: string): ClientData[] => {
    const rows = text.split('\n')
      .map(row => row.trim())
      .filter(row => row.length > 0)
      .slice(1); // Skip header row

    return rows.map(row => {
      const columns = row.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
      return {
        name: columns[0].replace('*', '').trim(), // Remove asterisk from names
        address: columns[1],
        travelTime: columns[4],
        preferredDay: columns[10],
        jobLength: columns[11],
      };
    });
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

      const assignments: { [key: string]: ClientData[] } = {};
      
      // Initialize empty arrays for each team
      teamNames.forEach(team => {
        assignments[team] = [];
      });

      // Distribute items evenly
      csvData.forEach((item, index) => {
        const teamIndex = index % teamNames.length;
        assignments[teamNames[teamIndex]].push(item);
      });

      setAssignments(assignments);
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

        {Object.keys(assignments).length > 0 && (
          <Box mt={8}>
            <Heading as="h2" size="lg" mb={4}>
              Team Assignments
            </Heading>
            {Object.entries(assignments).map(([team, clients]) => (
              <Box key={team} mb={8} p={4} borderWidth={1} borderRadius="md">
                <Heading as="h3" size="md" mb={4}>
                  {team}
                </Heading>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Client Name</Th>
                      <Th>Address</Th>
                      <Th>Travel Time</Th>
                      <Th>Preferred Day</Th>
                      <Th>Job Length</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {clients.map((client, index) => (
                      <Tr key={index}>
                        <Td>{client.name}</Td>
                        <Td>{client.address}</Td>
                        <Td>{client.travelTime}</Td>
                        <Td>{client.preferredDay || 'Any'}</Td>
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
