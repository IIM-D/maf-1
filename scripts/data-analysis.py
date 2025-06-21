import numpy as np
import json
import os
from typing import List, Dict, Tuple

class ExperimentAnalyzer:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.candidate_list = [
            ('CMAS', '_wo_any_dialogue_history'), 
            ('CMAS', '_w_only_state_action_history'),
            ('HMAS-2', '_wo_any_dialogue_history'), 
            ('HMAS-2', '_w_only_state_action_history'),
            ('HMAS-2', '_w_all_dialogue_history'), 
            ('HMAS-1', '_w_only_state_action_history')
        ]
    
    def analyze_results(self) -> Dict:
        """Analyze experiment results across different configurations"""
        results = {}
        
        for pg_row_num, pg_column_num in [(2, 2), (2, 4), (4, 4), (4, 8)]:
            grid_key = f"{pg_row_num}x{pg_column_num}"
            results[grid_key] = self._analyze_grid_size(pg_row_num, pg_column_num)
        
        return results
    
    def _analyze_grid_size(self, pg_row_num: int, pg_column_num: int) -> Dict:
        """Analyze results for a specific grid size"""
        grid_results = {}
        
        for framework, dialogue_method in self.candidate_list:
            config_key = f"{framework}{dialogue_method}"
            grid_results[config_key] = self._analyze_configuration(
                pg_row_num, pg_column_num, framework, dialogue_method
            )
        
        return grid_results
    
    def _analyze_configuration(self, pg_row_num: int, pg_column_num: int, 
                             framework: str, dialogue_method: str) -> Dict:
        """Analyze results for a specific configuration"""
        success_count = 0
        total_action_time = 0
        total_token_usage = 0
        total_api_queries = 0
        valid_experiments = 0
        
        for iteration in range(10):
            result_path = os.path.join(
                self.data_dir,
                f'env_pg_state_{pg_row_num}_{pg_column_num}',
                f'pg_state{iteration}',
                f'{framework}{dialogue_method}'
            )
            
            if not os.path.exists(result_path):
                continue
            
            # Read success/failure status
            success_file = os.path.join(result_path, 'success_failure.txt')
            if os.path.exists(success_file):
                with open(success_file, 'r') as f:
                    status = f.readline().strip()
                
                if status == 'success':
                    success_count += 1
                    
                    # Read action times
                    action_time_file = os.path.join(result_path, 'env_action_times.txt')
                    if os.path.exists(action_time_file):
                        with open(action_time_file, 'r') as f:
                            action_time = float(f.readline().strip())
                            total_action_time += action_time
                    
                    # Read token usage
                    token_file = os.path.join(result_path, 'token_num_count.txt')
                    if os.path.exists(token_file):
                        with open(token_file, 'r') as f:
                            tokens = [float(line.strip()) for line in f.readlines()]
                            total_token_usage += sum(tokens)
                            total_api_queries += len(tokens)
                
                valid_experiments += 1
        
        return {
            'success_rate': success_count / max(valid_experiments, 1),
            'avg_action_time': total_action_time / max(success_count, 1),
            'avg_token_usage': total_token_usage / max(success_count, 1),
            'avg_api_queries': total_api_queries / max(success_count, 1),
            'total_experiments': valid_experiments
        }
    
    def generate_comparison_report(self) -> str:
        """Generate a comprehensive comparison report"""
        results = self.analyze_results()
        
        report = "# Multi-Agent Framework Analysis Report\n\n"
        
        for grid_size, grid_results in results.items():
            report += f"## Grid Size: {grid_size}\n\n"
            
            # Create comparison table
            report += "| Framework | Dialogue Method | Success Rate | Avg Action Time | Avg Token Usage | Avg API Queries |\n"
            report += "|-----------|----------------|--------------|-----------------|-----------------|------------------|\n"
            
            for config, metrics in grid_results.items():
                framework, method = config.split('_', 1)
                method_display = method.replace('_', ' ').title()
                
                report += f"| {framework} | {method_display} | "
                report += f"{metrics['success_rate']:.2%} | "
                report += f"{metrics['avg_action_time']:.1f} | "
                report += f"{metrics['avg_token_usage']:.0f} | "
                report += f"{metrics['avg_api_queries']:.1f} |\n"
            
            report += "\n"
        
        return report

if __name__ == "__main__":
    # Example usage
    analyzer = ExperimentAnalyzer('/path/to/experiment/data')
    results = analyzer.analyze_results()
    report = analyzer.generate_comparison_report()
    
    print(report)
    
    # Save results to JSON
    with open('experiment_analysis.json', 'w') as f:
        json.dump(results, f, indent=2)
