from setuptools import setup, find_packages

with open("README.md", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="polaris",
    version="0.0.0",
    packages=find_packages(),
    author="Galaxy Team",
    author_email="info@galaxyproject.org",
    description="Execution runtime for Polaris intent graphs",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/galaxyproject",
    license="MIT",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.7",
    include_package_data=True,
)
