#!/usr/bin/env python3
import sys
import numpy as np
import json


def get_statistics_for_list(lst):
    mean = np.mean(lst)
    std = np.std(lst)

    return mean, std


def main():
    if len(sys.argv) < 2:
        raise Exception('Benchmark results file not provided')

    (_, filename) = sys.argv

    print(filename)
    with open(filename) as benchmarkFile:
        results = json.load(benchmarkFile)
        if type(results) is list:
            print(f'Results from {len(results)} iterations:')
            (mean, std) = get_statistics_for_list(results)
            print('Mean: ' + str(mean))
            print('Standard deviation: ' + str(std))
        elif type(results) is dict:
            for key in results.keys():
                (mean, std) = get_statistics_for_list(results[key])
                print(f'{key} results from {len(results[key])} iterations:')
                print('\tMean: ' + str(mean))
                print('\tStandard deviation: ' + str(std))
        else:
            print('Unsupported results object: ' + str(type(results)))


if __name__ == '__main__':
    main()
