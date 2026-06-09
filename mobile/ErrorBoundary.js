import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, padding: 20, paddingTop: 60, backgroundColor: 'red' }}>
          <Text style={{ fontSize: 24, color: 'white', fontWeight: 'bold' }}>APP CRASHED!</Text>
          <ScrollView>
            <Text style={{ color: 'white', marginTop: 10 }}>{this.state.error?.toString()}</Text>
            <Text style={{ color: 'white', marginTop: 10, fontSize: 10 }}>{this.state.errorInfo?.componentStack}</Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}
