import json
import os
import random
import shutil
from typing import List, Dict, Tuple

class ArtifactEnvironmentCreator:
    """Creates environments for multi-agent artifact manipulation experiments"""
    
    def __init__(self, base_path: str):
        self.base_path = base_path
        self.colors = ['blue', 'red', 'green', 'purple', 'orange']
    
    def create_environment(self, pg_row_num: int, pg_column_num: int, 
                         artifact_num_low: int = 1, artifact_num_high: int = 1) -> Dict:
        """Create a single environment configuration"""
        
        # Initialize grid dictionary
        pg_dict = {}
        
        # Initialize agent squares (center coordinates)
        for i in range(pg_row_num):
            for j in range(pg_column_num):
                pg_dict[f"{i+0.5}_{j+0.5}"] = []
        
        # Initialize corner positions
        for i in range(pg_row_num + 1):
            for j in range(pg_column_num + 1):
                pg_dict[f"{float(i)}_{float(j)}"] = []
        
        # Place artifacts and targets
        for color in self.colors:
            artifact_num = random.randint(artifact_num_low, artifact_num_high)
            
            for _ in range(artifact_num):
                # Random position for artifact (corner)
                artifact_square = random.randint(0, pg_row_num * pg_column_num - 1)
                a_artifact = artifact_square // pg_column_num
                b_artifact = artifact_square % pg_column_num
                
                # Random position for target (agent square)
                target_square = random.randint(0, pg_row_num * pg_column_num - 1)
                a_target = target_square // pg_column_num
                b_target = target_square % pg_column_num
                
                # Try to place artifact in available corner
                corner_options = [(1.0, 0.0), (0.0, 0.0), (0.0, 1.0), (1.0, 1.0)]
                random.shuffle(corner_options)
                
                for random_x, random_y in corner_options:
                    corner_key = f"{float(a_artifact) + random_x}_{float(b_artifact) + random_y}"
                    if len(pg_dict[corner_key]) == 0:
                        pg_dict[corner_key].append(f'artifact_{color}')
                        pg_dict[f"{a_target+0.5}_{b_target+0.5}"].append(f'target_{color}')
                        break
        
        return pg_dict
    
    def create_experiment_suite(self, repeat_num: int = 10):
        """Create a complete suite of experiments"""
        
        if os.path.exists(self.base_path):
            shutil.rmtree(self.base_path)
        os.makedirs(self.base_path, exist_ok=True)
        
        grid_sizes = [(2, 2), (2, 4), (4, 4), (4, 8)]
        
        for rows, cols in grid_sizes:
            grid_dir = os.path.join(self.base_path, f'env_pg_state_{rows}_{cols}')
            os.makedirs(grid_dir, exist_ok=True)
            
            for iteration in range(repeat_num):
                iteration_dir = os.path.join(grid_dir, f'pg_state{iteration}')
                os.makedirs(iteration_dir, exist_ok=True)
                
                # Create environment
                environment = self.create_environment(rows, cols)
                
                # Save environment configuration
                config_file = os.path.join(iteration_dir, f'pg_state{iteration}.json')
                with open(config_file, 'w') as f:
                    json.dump(environment, f, indent=2)
                
                print(f"Created environment: {rows}x{cols}, iteration {iteration}")
    
    def validate_environment(self, environment: Dict) -> bool:
        """Validate that an environment is properly configured"""
        
        artifact_count = 0
        target_count = 0
        
        for position, items in environment.items():
            for item in items:
                if item.startswith('artifact_'):
                    artifact_count += 1
                elif item.startswith('target_'):
                    target_count += 1
        
        # Should have equal numbers of artifacts and targets
        return artifact_count == target_count and artifact_count > 0

if __name__ == "__main__":
    # Create experiment environments
    creator = ArtifactEnvironmentCreator('/path/to/experiment/environments')
    creator.create_experiment_suite(repeat_num=10)
    
    print("Environment creation completed!")
