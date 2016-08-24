# Compass

A secure, versatile site for VCF manipulation that runs entirely in the browser. 

Website: https://compass.dna.land

GitHub: https://github.com/TeamErlich/dna-land-compass

Synopsis
--------

#### Setup
Compass accepts a matching compressed VCF and Tabix index file. These files must have the extensions `.vcf.gz` and `.vcf.gz.tbi`, and they must have the same file name up to ".vcf".

#### Security
Compass will read the index file in its entirety on the user's computer, and it will scan the compressed VCF upon request. No information from the user's files—at any point—is transmitted or retained, eliminating a category of security vulnerabilities. The user can then search through their files in two ways. They may enter the rsID of an individual SNP, or they may select a topic (e.g., "Crohn's Disease") of interest, which returns SNPs that influence the topic with a p value below a certain threshold. 

#### External Resources 
The site uses the dbSNP database to gather the coordinates (chromosome and position) of each SNP, and NCBI's Phenotype-Genotype Integrator (PheGenI) to connect certain SNPs with physical conditions. 

#### Reporting
Once the coordinates are used to decompress a section of the user's VCF, the selection of SNPs is returned in a report. For each variant, the genotype is displayed, along with an array of resources (SNPedia, PubMed, dbSNP, GWAS, and Google).

Manuscript
-------

A manuscript is forthcoming, please stay tuned!

License and Copyright
-------
Copyright (C) 2016 Erlich Lab

All rights reserved.

Comapss is released under the BSD license. See the LICENSE file for more information. 

Contact
-------

Questions and feedback are welcomed and appreciated. Please email us at compass@dna.land.