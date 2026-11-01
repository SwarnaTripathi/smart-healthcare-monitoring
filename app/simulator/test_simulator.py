"""
Automated Unit Tests for IoT Simulator & Synthetic Scenarios
Tests repeatability, synthetic data labeling, validation, scenario modes, and process safety.
"""

import os
import unittest
from scenario_generator import (
    SyntheticScenarioGenerator,
    SCENARIO_NORMAL,
    SCENARIO_GRADUAL_DETERIORATION,
    SCENARIO_SUDDEN_SPIKE,
    SCENARIO_MISSING_DATA,
    SCENARIO_STALE_DATA,
    SCENARIO_DUPLICATE_DATA,
    SCENARIO_NOISY_ARTIFACT
)
from iot_simulator import (
    validate_client_payload,
    get_pid_path,
    acquire_pid_lock,
    is_pid_running
)

class TestSyntheticScenarioGenerator(unittest.TestCase):

    def test_repeatable_generation_with_seed(self):
        """Same seed must produce identical telemetry sequences (determinism)."""
        gen1 = SyntheticScenarioGenerator(seed=123)
        gen2 = SyntheticScenarioGenerator(seed=123)

        seq1 = gen1.generate_scenario_sequence(SCENARIO_NORMAL, count=10)
        seq2 = gen2.generate_scenario_sequence(SCENARIO_NORMAL, count=10)

        for r1, r2 in zip(seq1, seq2):
            self.assertEqual(r1['heartRate'], r2['heartRate'])
            self.assertEqual(r1['spO2'], r2['spO2'])
            self.assertEqual(r1['temperature'], r2['temperature'])

    def test_different_seeds_produce_variation(self):
        """Different seeds must yield independent variation."""
        gen1 = SyntheticScenarioGenerator(seed=101)
        gen2 = SyntheticScenarioGenerator(seed=202)

        seq1 = gen1.generate_scenario_sequence(SCENARIO_NORMAL, count=10)
        seq2 = gen2.generate_scenario_sequence(SCENARIO_NORMAL, count=10)

        hr_differences = [r1['heartRate'] != r2['heartRate'] for r1, r2 in zip(seq1, seq2)]
        self.assertTrue(any(hr_differences), "Different seeds should produce differing values")

    def test_all_records_labeled_as_synthetic(self):
        """Requirement 3: Every generated record must be explicitly labeled as synthetic."""
        gen = SyntheticScenarioGenerator(seed=42)
        seq = gen.generate_scenario_sequence(SCENARIO_NORMAL, count=5)

        for record in seq:
            self.assertIn('isSynthetic', record)
            self.assertTrue(record['isSynthetic'])
            self.assertEqual(record['syntheticProvenance'], 'SmartHealthcare-IoT-Simulator')
            self.assertIn('groundTruthLabel', record)

    def test_scenario_gradual_deterioration(self):
        """Gradual deterioration must show progressive SpO2 decline and HR rise."""
        gen = SyntheticScenarioGenerator(seed=42)
        seq = gen.generate_scenario_sequence(SCENARIO_GRADUAL_DETERIORATION, count=15)

        initial_spo2 = seq[0]['spO2']
        final_spo2 = seq[-1]['spO2']
        self.assertGreater(initial_spo2, final_spo2, "SpO2 must decline over time in gradual deterioration")
        self.assertTrue(any(r['groundTruthLabel'] in ('warning_trend', 'critical_anomaly') for r in seq[5:]))

    def test_scenario_sudden_spike(self):
        """Sudden spike scenario must trigger critical anomaly at step 8."""
        gen = SyntheticScenarioGenerator(seed=42)
        seq = gen.generate_scenario_sequence(SCENARIO_SUDDEN_SPIKE, count=12)

        for r in seq[:8]:
            self.assertEqual(r['groundTruthLabel'], 'normal')
        for r in seq[8:]:
            self.assertEqual(r['groundTruthLabel'], 'critical_anomaly')
            self.assertGreater(r['heartRate'], 150)

    def test_scenario_missing_data(self):
        """Missing data scenario must omit designated fields at steps 4 and 8."""
        gen = SyntheticScenarioGenerator(seed=42)
        seq = gen.generate_scenario_sequence(SCENARIO_MISSING_DATA, count=10)

        self.assertNotIn('heartRate', seq[4])
        self.assertNotIn('heartRate', seq[8])
        self.assertEqual(seq[4]['groundTruthLabel'], 'invalid')
        self.assertEqual(seq[8]['groundTruthLabel'], 'invalid')

    def test_scenario_stale_and_duplicate(self):
        """Stale and duplicate scenarios must flag appropriate timestamps."""
        gen = SyntheticScenarioGenerator(seed=42)
        seq_stale = gen.generate_scenario_sequence(SCENARIO_STALE_DATA, count=10)
        self.assertTrue(seq_stale[6].get('isStaleTest'))

        seq_dup = gen.generate_scenario_sequence(SCENARIO_DUPLICATE_DATA, count=10)
        self.assertTrue(seq_dup[5].get('isDuplicateTest'))


class TestClientPayloadValidation(unittest.TestCase):

    def test_valid_payload_passes(self):
        payload = {
            'patientId': 'PT-00001',
            'deviceId': 'SIM-001',
            'heartRate': 75,
            'spO2': 98.0,
            'temperature': 36.6
        }
        valid, msg = validate_client_payload(payload)
        self.assertTrue(valid)
        self.assertEqual(msg, "Valid")

    def test_missing_fields_fail_validation(self):
        missing_hr = {
            'patientId': 'PT-00001',
            'deviceId': 'SIM-001',
            'spO2': 98.0,
            'temperature': 36.6
        }
        valid, msg = validate_client_payload(missing_hr)
        self.assertFalse(valid)
        self.assertIn('heartRate', msg)

    def test_unphysiologic_values_fail_validation(self):
        bad_spo2 = {
            'patientId': 'PT-00001',
            'deviceId': 'SIM-001',
            'heartRate': 75,
            'spO2': 30.0,
            'temperature': 36.6
        }
        valid, msg = validate_client_payload(bad_spo2)
        self.assertFalse(valid)
        self.assertIn('SpO2', msg)


class TestProcessSafetyAndPidLock(unittest.TestCase):

    def test_pid_lock_creation_and_removal(self):
        test_patient = "TEST-PAT-999"
        pid_file = get_pid_path(test_patient)

        # Cleanup any pre-existing file
        if os.path.exists(pid_file):
            os.remove(pid_file)

        cleanup_fn = acquire_pid_lock(test_patient)
        self.assertTrue(os.path.exists(pid_file), "PID file must be created")

        with open(pid_file, 'r') as f:
            pid = int(f.read().strip())
        self.assertEqual(pid, os.getpid())
        self.assertTrue(is_pid_running(pid))

        # Test cleanup
        cleanup_fn()
        self.assertFalse(os.path.exists(pid_file), "PID file must be removed after cleanup")

if __name__ == '__main__':
    unittest.main()
